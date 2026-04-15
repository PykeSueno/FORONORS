'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setError(data.message ?? 'Connexion impossible.');
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
    } catch {
      setError('Connexion impossible. Vérifiez la connexion puis réessayez.');
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

          <button type="submit" disabled={loading} className="saas-primary-btn w-full disabled:opacity-70">
            {loading ? 'Connexion...' : 'Connexion'}
          </button>

        </form>
      </div>
    </main>
  );
}
