'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Member = {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

type EditableMember = Member & {
  editingRole: string;
  editingActive: boolean;
};

export default function MembersPage() {
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  async function loadMembers() {
    setLoading(true);
    const response = await fetch('/api/members');
    const data = (await response.json()) as { members: Member[]; message?: string };

    if (!response.ok) {
      setError(data.message ?? 'Impossible de charger les membres.');
      setLoading(false);
      return;
    }

    setMembers(
      data.members.map((member) => ({
        ...member,
        editingRole: member.role ?? '',
        editingActive: member.is_active
      }))
    );
    setError('');
    setLoading(false);
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  const totalMembers = members.length;
  const activeMembers = useMemo(() => members.filter((member) => member.is_active).length, [members]);

  async function saveMember(member: EditableMember) {
    const response = await fetch(`/api/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: member.editingRole, is_active: member.editingActive })
    });

    if (!response.ok) {
      setError('Mise à jour impossible.');
      return;
    }

    await loadMembers();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-coffee-700 bg-coffee-900 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-coffee-200/65">Espace privé</p>
            <h1 className="mt-2 text-3xl font-semibold">Gestion des membres</h1>
            <p className="mt-2 max-w-2xl text-sm text-coffee-200/75">
              Gérez vos accès internes dans un espace simple, moderne et totalement flexible.
            </p>
          </div>

          <button
            className="rounded-2xl bg-coffee-200 px-5 py-2.5 text-sm font-semibold text-coffee-950 shadow-sm transition hover:bg-coffee-100"
            onClick={() => setShowModal(true)}
          >
            + Créer un membre
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard label="Membres" value={String(totalMembers)} />
        <StatCard label="Actifs" value={String(activeMembers)} />
      </section>

      <section className="overflow-hidden rounded-3xl border border-coffee-700 bg-coffee-900 shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
        <div className="border-b border-coffee-700/70 px-6 py-4">
          <h2 className="text-lg font-medium">Liste des membres</h2>
        </div>

        {error ? <p className="px-6 py-4 text-sm text-red-300">{error}</p> : null}

        {loading ? (
          <p className="px-6 py-5 text-sm text-coffee-200/80">Chargement...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-coffee-800/80 text-coffee-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Username</th>
                  <th className="px-6 py-3 font-medium">Rôle</th>
                  <th className="px-6 py-3 font-medium">Statut</th>
                  <th className="px-6 py-3 font-medium">Créé le</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-coffee-700/80">
                    <td className="px-6 py-4">{member.username}</td>
                    <td className="px-6 py-4">
                      <input
                        className="w-44 rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-2 text-coffee-100"
                        value={member.editingRole}
                        onChange={(event) =>
                          setMembers((current) =>
                            current.map((item) =>
                              item.id === member.id ? { ...item, editingRole: event.target.value } : item
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-6 py-4">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-coffee-700 px-3 py-2 text-xs text-coffee-200">
                        <input
                          type="checkbox"
                          checked={member.editingActive}
                          onChange={(event) =>
                            setMembers((current) =>
                              current.map((item) =>
                                item.id === member.id ? { ...item, editingActive: event.target.checked } : item
                              )
                            )
                          }
                        />
                        {member.editingActive ? 'Actif' : 'Inactif'}
                      </label>
                    </td>
                    <td className="px-6 py-4 text-coffee-200/75">{new Date(member.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4">
                      <button
                        className="rounded-xl border border-coffee-700 px-4 py-2 text-xs text-coffee-200 transition hover:bg-coffee-800"
                        onClick={() => void saveMember(member)}
                      >
                        Enregistrer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal ? <CreateMemberModal onClose={() => setShowModal(false)} onCreated={loadMembers} /> : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-coffee-700 bg-coffee-900 p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-coffee-200/65">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function CreateMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, is_active: isActive })
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-3xl border border-coffee-700 bg-coffee-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">Créer un membre</h2>
        <p className="mt-1 text-sm text-coffee-200/75">Ajoutez un nouvel accès interne.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-2.5"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-2.5"
            placeholder="Mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-2.5"
            placeholder="Rôle libre"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-coffee-200">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Actif
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-xl border border-coffee-700 px-4 py-2 text-sm" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="rounded-xl bg-coffee-200 px-4 py-2 text-sm font-semibold text-coffee-950">
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
