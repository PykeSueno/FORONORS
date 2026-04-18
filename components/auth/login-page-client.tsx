'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginPageClient() {
  const authDebug = process.env.NEXT_PUBLIC_AUTH_DEBUG === '1';
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const token = localStorage.getItem('foronors_session_token') || sessionStorage.getItem('foronors_session_token');
        if (!token) return;
        const response = await fetch('/api/session/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ remember: true })
        });
        if (!response.ok) return;
        const data = (await response.json()) as { sessionToken?: string };
        if (data.sessionToken) {
          localStorage.setItem('foronors_session_token', data.sessionToken);
          sessionStorage.setItem('foronors_session_token', data.sessionToken);
          document.cookie = `foronors_session=${encodeURIComponent(data.sessionToken)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        }
        if (!cancelled) {
          router.replace('/dashboard');
          router.refresh();
        }
      } catch {
        // ignore restore errors on login page
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    void restoreSession();
    return () => { cancelled = true; };
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (authDebug) console.info('[LOGIN:UI] click', { username, remember });
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });
      if (authDebug) console.info('[LOGIN:UI] response', { status: response.status });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        if (response.status === 401) setError('Identifiant ou mot de passe incorrect.');
        else if (response.status === 403) setError('Compte inactif ou accès refusé.');
        else setError(data.message ?? 'Connexion impossible.');
        setLoading(false);
        return;
      }

      const data = (await response.json()) as { sessionToken?: string };
      if (data.sessionToken) {
        try {
          localStorage.setItem('foronors_session_token', data.sessionToken);
          sessionStorage.setItem('foronors_session_token', data.sessionToken);
        } catch {
          // no-op for environments with restricted storage
        }
        document.cookie = `foronors_session=${encodeURIComponent(data.sessionToken)}; Path=/; Max-Age=${remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      router.push('/dashboard');
      router.refresh();
      if (authDebug) console.info('[LOGIN:UI] redirection dashboard');
    } catch {
      setError('Impossible de joindre le serveur depuis cet environnement (réseau FiveM / API).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/foronors-logo.svg')",
          backgroundSize: 'min(76vw, 760px)',
          opacity: 0.09,
          filter: 'blur(10px)',
          transform: 'scale(1.1)'
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#2d1b11]/70 via-[#412819]/62 to-[#22130d]/78" />

      {restoring ? (
        <div className="glass-card relative z-10 w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-wide text-[#fff1dc]">FORONORS</h1>
          <p className="mt-3 text-sm text-[#f4d4ae]">Connexion en cours...</p>
        </div>
      ) : (
        <div className="glass-card relative z-10 w-full max-w-md p-8">
          <h1 className="mb-6 text-center text-2xl font-semibold tracking-wide text-[#fff1dc]">FORONORS</h1>

          <form onSubmit={onSubmit} className="space-y-4">
            <input className="saas-input w-full" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <input
              type="password"
              className="saas-input w-full"
              placeholder="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error ? <p className="text-sm text-red-100">{error}</p> : null}

            <label className="flex items-center gap-2 text-sm text-[#f4d4ae]">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Rester connecté
            </label>

            <button type="submit" disabled={loading || restoring} className="saas-primary-btn w-full disabled:opacity-70">
              {loading ? 'Connexion...' : 'Connexion'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
