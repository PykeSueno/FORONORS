'use client';

import { useEffect, useState } from 'react';

type Member = {
  id: string;
  username: string;
  role: 'super_admin' | 'admin' | 'member';
  is_active: boolean;
  created_at: string;
};

export function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Member['role']>('member');
  const [isActive, setIsActive] = useState(true);

  async function loadMembers() {
    setLoading(true);
    const response = await fetch('/api/members');
    const body = (await response.json()) as { message?: string; members?: Member[] };

    if (!response.ok) {
      setError(body.message ?? 'Impossible de charger les membres.');
      setLoading(false);
      return;
    }

    setMembers(body.members ?? []);
    setError(null);
    setLoading(false);
  }

  async function handleCreateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, isActive }),
    });

    const body = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(body.message ?? 'Impossible de créer le membre.');
      return;
    }

    setUsername('');
    setPassword('');
    setRole('member');
    setIsActive(true);
    await loadMembers();
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <article className="rounded-2xl border border-[#8f765d]/35 bg-[#1f1712] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-[#f4e8db]">Liste des membres</h2>
          <button onClick={() => void loadMembers()} className="rounded-lg border border-[#8f765d]/45 px-3 py-1.5 text-xs text-[#f4e8db] hover:bg-[#2b2018]">
            Actualiser
          </button>
        </div>

        {loading ? <p className="text-sm text-[#d7c2aa]">Chargement...</p> : null}
        {!loading && members.length === 0 ? <p className="text-sm text-[#d7c2aa]">Aucun membre pour le moment.</p> : null}

        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id} className="rounded-xl border border-[#8f765d]/30 bg-[#271d16] px-3 py-2 text-sm text-[#f2e7da]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{member.username}</span>
                <span className="text-xs text-[#d7c2aa]">
                  {member.role} • {member.is_active ? 'actif' : 'inactif'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-2xl border border-[#8f765d]/35 bg-[#1f1712] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
        <h2 className="mb-4 text-base font-medium text-[#f4e8db]">Créer un membre</h2>

        <form className="space-y-3" onSubmit={handleCreateMember}>
          <input
            required
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border border-[#846a53] bg-[#2a2019] px-4 py-2.5 text-sm text-[#fff7ee] outline-none focus:border-[#d8c1a9] focus:ring-2 focus:ring-[#d8c1a9]/25"
          />
          <input
            required
            placeholder="Mot de passe"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-[#846a53] bg-[#2a2019] px-4 py-2.5 text-sm text-[#fff7ee] outline-none focus:border-[#d8c1a9] focus:ring-2 focus:ring-[#d8c1a9]/25"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Member['role'])}
            className="w-full rounded-xl border border-[#846a53] bg-[#2a2019] px-4 py-2.5 text-sm text-[#fff7ee] outline-none focus:border-[#d8c1a9] focus:ring-2 focus:ring-[#d8c1a9]/25"
          >
            <option value="super_admin">super_admin</option>
            <option value="admin">admin</option>
            <option value="member">member</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-[#f2e7da]">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Compte actif
          </label>

          {error ? <p className="text-sm text-[#ffb3b3]">{error}</p> : null}

          <button type="submit" className="w-full rounded-xl bg-[#f0e3d6] px-4 py-2.5 text-sm font-semibold text-[#2e2218] hover:bg-[#fff3e7]">
            Créer un membre
          </button>
        </form>
      </article>
    </div>
  );
}
