'use client';

import { FormEvent, useState } from 'react';

type Role = { id: number; name: string };

type CreateMemberModalProps = {
  roles: Role[];
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export function CreateMemberModal({ roles, onClose, onCreated }: CreateMemberModalProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, role_id: roleId, is_active: true })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Création impossible.');
      return;
    }

    await onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#f8e6cf]">Créer un membre</h2>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input className="saas-input w-full" placeholder="Nom" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="saas-input w-full" placeholder="User" value={username} onChange={(event) => setUsername(event.target.value)} required />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="saas-input w-full pr-11"
              placeholder="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 saas-ghost-btn !px-2 !py-1" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <select className="saas-input w-full" value={roleId ?? ''} onChange={(event) => setRoleId(event.target.value ? Number(event.target.value) : null)}>
            <option value="">Sans rôle</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="saas-ghost-btn">Annuler</button>
            <button type="submit" className="saas-primary-btn">Créer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
