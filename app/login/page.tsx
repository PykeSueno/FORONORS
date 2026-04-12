'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Connexion impossible.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="premium-panel w-full max-w-md rounded-3xl p-8">
        <Logo />

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-[#e5ccab]">Nom d&apos;utilisateur</label>
            <input
              className="premium-input w-full"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#e5ccab]">Mot de passe</label>
            <input
              type="password"
              className="premium-input w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button type="submit" disabled={loading} className="premium-button w-full disabled:opacity-70">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <button type="button" className="w-full text-sm text-[#d3b28d] underline underline-offset-4">
            Mot de passe oublié ?
          </button>
        </form>
      </div>
    </main>
  );
}
