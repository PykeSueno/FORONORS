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

    const response = await fetch('/api/login', {
      method: 'POST',
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
      localStorage.setItem('foronors_session_token', data.sessionToken);
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/foronors-logo.svg')",
          backgroundSize: '70%',
          opacity: 0.05,
          filter: 'blur(16px)',
          transform: 'scale(1.1)'
        }}
      />

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
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

        </form>
      </div>
    </main>
  );
}
