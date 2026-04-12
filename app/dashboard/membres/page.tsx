'use client';

import { FormEvent, useEffect, useState } from 'react';

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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Membres</h1>
          <p className="mt-1 text-sm text-coffee-200/80">Gestion complète des utilisateurs internes.</p>
        </div>

        <button
          className="rounded-lg bg-coffee-200 px-4 py-2 text-sm font-semibold text-coffee-950"
          onClick={() => setShowModal(true)}
        >
          Créer
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-coffee-200/80">Chargement...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-coffee-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-coffee-800 text-coffee-200">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Créé le</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-coffee-700">
                  <td className="px-4 py-3">{member.username}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-40 rounded-lg border border-coffee-700 bg-coffee-800 px-2 py-1"
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
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2">
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
                  <td className="px-4 py-3 text-coffee-200/80">{new Date(member.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded-lg border border-coffee-700 px-3 py-1 hover:bg-coffee-800"
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

      {showModal ? <CreateMemberModal onClose={() => setShowModal(false)} onCreated={loadMembers} /> : null}
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-coffee-700 bg-coffee-900 p-6">
        <h2 className="text-lg font-semibold">Créer un membre</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            className="w-full rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2"
            placeholder="Mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2"
            placeholder="Rôle libre"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Actif
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-lg border border-coffee-700 px-3 py-2" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="rounded-lg bg-coffee-200 px-3 py-2 font-semibold text-coffee-950">
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
