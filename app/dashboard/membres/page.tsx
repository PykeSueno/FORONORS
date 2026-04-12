'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Tab = 'members' | 'roles' | 'permissions';

type Permission = { id: number; name: string };
type Role = { id: number; name: string; permission_ids: number[]; permissions: Permission[] };
type Member = {
  id: string;
  username: string;
  role_id: number | null;
  role_name: string;
  is_active: boolean;
  created_at: string;
};

type EditableMember = Member & { editingRoleId: number | null; editingActive: boolean };

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPermissionName, setNewPermissionName] = useState('');

  async function loadAll() {
    setLoading(true);

    const [membersResponse, rolesResponse, permissionsResponse] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/roles'),
      fetch('/api/permissions')
    ]);

    const membersData = (await membersResponse.json()) as { members?: Member[]; message?: string };
    const rolesData = (await rolesResponse.json()) as { roles?: Role[]; message?: string };
    const permissionsData = (await permissionsResponse.json()) as { permissions?: Permission[]; message?: string };

    if (!membersResponse.ok || !rolesResponse.ok || !permissionsResponse.ok) {
      setError(membersData.message ?? rolesData.message ?? permissionsData.message ?? 'Chargement impossible.');
      setLoading(false);
      return;
    }

    setMembers(
      (membersData.members ?? []).map((member) => ({
        ...member,
        editingRoleId: member.role_id,
        editingActive: member.is_active
      }))
    );
    setRoles(rolesData.roles ?? []);
    setPermissions(permissionsData.permissions ?? []);
    setError('');
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const totalMembers = members.length;
  const activeMembers = useMemo(() => members.filter((member) => member.is_active).length, [members]);

  async function saveMember(member: EditableMember) {
    const response = await fetch(`/api/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: member.editingRoleId, is_active: member.editingActive })
    });

    if (!response.ok) {
      setError('Mise à jour impossible.');
      return;
    }

    await loadAll();
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName })
    });

    if (!response.ok) {
      setError('Création du rôle impossible.');
      return;
    }

    setNewRoleName('');
    await loadAll();
  }

  async function createPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPermissionName })
    });

    if (!response.ok) {
      setError('Création de permission impossible.');
      return;
    }

    setNewPermissionName('');
    await loadAll();
  }

  async function toggleRolePermission(role: Role, permissionId: number) {
    const exists = role.permission_ids.includes(permissionId);
    const updatedPermissionIds = exists
      ? role.permission_ids.filter((id) => id !== permissionId)
      : [...role.permission_ids, permissionId];

    const response = await fetch(`/api/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_ids: updatedPermissionIds })
    });

    if (!response.ok) {
      setError('Attribution impossible.');
      return;
    }

    await loadAll();
  }

  return (
    <div className="space-y-6">
      <section className="premium-panel rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#d7c2a0]/75">Private gaming app</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#f5e6cf]">Module Membres</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#dcc5a0]/80">
              Espace premium de gestion des comptes, rôles et permissions avec une interface propre et lumineuse.
            </p>
          </div>

          <button className="premium-button" onClick={() => setMemberModalOpen(true)}>
            + Nouveau membre
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <TabButton tab="members" activeTab={activeTab} onClick={setActiveTab} label="Membres" />
          <TabButton tab="roles" activeTab={activeTab} onClick={setActiveTab} label="Rôles" />
          <TabButton tab="permissions" activeTab={activeTab} onClick={setActiveTab} label="Permissions" />
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      {activeTab === 'members' ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <StatCard label="Membres" value={String(totalMembers)} />
            <StatCard label="Actifs" value={String(activeMembers)} />
          </section>

          <section className="premium-panel overflow-hidden rounded-3xl">
            <div className="border-b border-[#6e5132]/60 px-6 py-4">
              <h2 className="text-lg font-medium text-[#f5e6cf]">Gestion des membres</h2>
            </div>

            {loading ? (
              <p className="px-6 py-5 text-sm text-[#d8c2a2]/80">Chargement...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#2b1d15]/90 text-[#ddc4a3]">
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
                      <tr key={member.id} className="border-t border-[#6e5132]/40 transition hover:bg-[#2d2018]/70">
                        <td className="px-6 py-4 text-[#f1ddbe]">{member.username}</td>
                        <td className="px-6 py-4">
                          <select
                            className="premium-input w-52"
                            value={member.editingRoleId ?? ''}
                            onChange={(event) =>
                              setMembers((current) =>
                                current.map((item) =>
                                  item.id === member.id
                                    ? { ...item, editingRoleId: event.target.value ? Number(event.target.value) : null }
                                    : item
                                )
                              )
                            }
                          >
                            <option value="">Sans rôle</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-[#7f603f] bg-[#1f1510] px-3 py-2 text-xs text-[#e8d3b2]">
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
                        <td className="px-6 py-4 text-[#c4a788]">{new Date(member.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-6 py-4">
                          <button className="premium-ghost" onClick={() => void saveMember(member)}>
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
        </>
      ) : null}

      {activeTab === 'roles' ? (
        <section className="premium-panel space-y-6 rounded-3xl p-6">
          <form onSubmit={createRole} className="flex flex-col gap-3 md:flex-row">
            <input
              className="premium-input flex-1"
              placeholder="Créer un rôle (ex: Administrateur)"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              required
            />
            <button type="submit" className="premium-button">
              Ajouter le rôle
            </button>
          </form>

          <div className="grid gap-4 lg:grid-cols-2">
            {roles.map((role) => (
              <article key={role.id} className="premium-card rounded-2xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[#f5e6cf]">{role.name}</h3>
                  <span className="text-xs text-[#cfb08f]">{role.permissions.length} permissions</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => {
                    const assigned = role.permission_ids.includes(permission.id);
                    return (
                      <button
                        key={`${role.id}-${permission.id}`}
                        onClick={() => void toggleRolePermission(role, permission.id)}
                        className={assigned ? 'permission-chip permission-chip-active' : 'permission-chip'}
                      >
                        {permission.name}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'permissions' ? (
        <section className="premium-panel space-y-6 rounded-3xl p-6">
          <form onSubmit={createPermission} className="flex flex-col gap-3 md:flex-row">
            <input
              className="premium-input flex-1"
              placeholder="Créer une permission (ex: members.write)"
              value={newPermissionName}
              onChange={(event) => setNewPermissionName(event.target.value)}
              required
            />
            <button type="submit" className="premium-button">
              Ajouter la permission
            </button>
          </form>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {permissions.map((permission) => (
              <div key={permission.id} className="premium-card rounded-2xl px-4 py-3 text-sm text-[#ead4b3]">
                {permission.name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {memberModalOpen ? (
        <CreateMemberModal roles={roles} onClose={() => setMemberModalOpen(false)} onCreated={loadAll} />
      ) : null}
    </div>
  );
}

function TabButton({
  tab,
  activeTab,
  onClick,
  label
}: {
  tab: Tab;
  activeTab: Tab;
  onClick: (tab: Tab) => void;
  label: string;
}) {
  const isActive = tab === activeTab;
  return (
    <button onClick={() => onClick(tab)} className={isActive ? 'premium-tab premium-tab-active' : 'premium-tab'}>
      {label}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-card rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[#cfb08f]/75">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#f9e9d1]">{value}</p>
    </div>
  );
}

function CreateMemberModal({
  onClose,
  onCreated,
  roles
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  roles: Role[];
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role_id: roleId, is_active: isActive })
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="premium-panel w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#f4e3cc]">Créer un membre</h2>
        <p className="mt-1 text-sm text-[#cfb08f]">Ajoutez un utilisateur et assignez son rôle.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            className="premium-input w-full"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            type="password"
            className="premium-input w-full"
            placeholder="Mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <select
            className="premium-input w-full"
            value={roleId ?? ''}
            onChange={(event) => setRoleId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Sans rôle</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-[#dcc5a4]">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Actif
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="premium-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="premium-button">
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
