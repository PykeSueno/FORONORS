'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CreateMemberModal } from '@/components/members/create-member-modal';

type Permission = { id: number; name: string };
type Role = {
  id: number;
  name: string;
  display_order: number;
  permission_ids: number[];
  permissions: Permission[];
};
type Member = {
  id: string;
  username: string;
  role_id: number | null;
  role_name: string;
  is_active: boolean;
};

type EditableMember = Member & { editingRoleId: number | null; editingActive: boolean };

const MODULE_SUGGESTIONS = ['dashboard.view', 'members.view', 'members.create', 'members.edit', 'roles.manage'];

export default function MembersPage() {
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberModalOpen, setMemberModalOpen] = useState(false);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleOrder, setNewRoleOrder] = useState('100');
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

    const loadedRoles = rolesData.roles ?? [];

    setMembers(
      (membersData.members ?? []).map((member) => ({
        ...member,
        editingRoleId: member.role_id,
        editingActive: member.is_active
      }))
    );
    setRoles(loadedRoles);
    setPermissions(permissionsData.permissions ?? []);

    if (loadedRoles.length > 0) {
      const chosenRoleId = selectedRoleId && loadedRoles.some((role) => role.id === selectedRoleId)
        ? selectedRoleId
        : loadedRoles[0].id;
      setSelectedRoleId(chosenRoleId);
      setSelectedPermissionIds(loadedRoles.find((role) => role.id === chosenRoleId)?.permission_ids ?? []);
    } else {
      setSelectedRoleId(null);
      setSelectedPermissionIds([]);
    }

    setError('');
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const totalMembers = members.length;
  const activeMembers = useMemo(() => members.filter((member) => member.is_active).length, [members]);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (selectedRole) {
      setSelectedPermissionIds(selectedRole.permission_ids);
    }
  }, [selectedRoleId]);

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
      body: JSON.stringify({ name: newRoleName, display_order: Number(newRoleOrder) || 100 })
    });

    if (!response.ok) {
      setError('Création du rôle impossible.');
      return;
    }

    setNewRoleName('');
    setNewRoleOrder('100');
    await loadAll();
  }

  async function updateRole(role: Role) {
    const response = await fetch(`/api/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: role.name, display_order: role.display_order })
    });

    if (!response.ok) {
      setError('Mise à jour du rôle impossible.');
      return;
    }

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

  async function saveSelectedRolePermissions() {
    if (!selectedRole) return;

    const response = await fetch(`/api/roles/${selectedRole.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_ids: selectedPermissionIds })
    });

    if (!response.ok) {
      setError('Enregistrement des permissions impossible.');
      return;
    }

    await loadAll();
  }

  function toggleSelectedPermission(permissionId: number) {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId) ? current.filter((id) => id !== permissionId) : [...current, permissionId]
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#fff0dc]">Membres</h1>
            <p className="mt-1 text-sm text-[#f6dcc0]">Interface claire pour gérer utilisateurs, rôles et permissions.</p>
          </div>
          <button className="saas-primary-btn" onClick={() => setMemberModalOpen(true)}>
            Créer
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total membres" value={String(totalMembers)} />
        <SummaryCard label="Membres actifs" value={String(activeMembers)} />
        <SummaryCard label="Rôles" value={String(roles.length)} />
      </section>

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/15 px-4 py-3 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card overflow-hidden p-0">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-[#fff1df]">Table des membres</h2>
        </div>

        <div className="overflow-x-auto px-3 pb-3 pt-2">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[#ffe5c8]">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="rounded-xl border border-white/10 bg-[#593925]/55 transition duration-200 hover:bg-[#6a452d]/60">
                  <td className="px-4 py-3 font-medium text-[#fff1de]">{member.username}</td>
                  <td className="px-4 py-3 text-[#ffe0c0]">@{member.username.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    <select
                      className="saas-input w-48"
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
                  <td className="px-4 py-3">
                    <button
                      className={member.editingActive ? 'status-badge status-active' : 'status-badge status-inactive'}
                      onClick={() =>
                        setMembers((current) =>
                          current.map((item) =>
                            item.id === member.id ? { ...item, editingActive: !item.editingActive } : item
                          )
                        )
                      }
                    >
                      {member.editingActive ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button className="saas-ghost-btn" onClick={() => void saveMember(member)}>
                      Sauvegarder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? <p className="px-3 py-2 text-xs text-[#ffe3c2]">Chargement...</p> : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <article className="glass-card p-5">
          <h3 className="text-lg font-semibold text-[#fff0de]">Rôles personnalisables</h3>
          <form onSubmit={createRole} className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <input
              className="saas-input"
              placeholder="Nom du rôle"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              required
            />
            <input
              className="saas-input"
              type="number"
              placeholder="Ordre"
              value={newRoleOrder}
              onChange={(event) => setNewRoleOrder(event.target.value)}
            />
            <button type="submit" className="saas-primary-btn">
              Créer
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="grid gap-2 rounded-xl border border-white/10 bg-[#563925]/50 p-3 sm:grid-cols-[1fr_130px_auto_auto]">
                <input
                  className="saas-input"
                  value={role.name}
                  onChange={(event) =>
                    setRoles((current) =>
                      current.map((item) => (item.id === role.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
                <input
                  className="saas-input"
                  type="number"
                  value={role.display_order}
                  onChange={(event) =>
                    setRoles((current) =>
                      current.map((item) =>
                        item.id === role.id ? { ...item, display_order: Number(event.target.value) || 0 } : item
                      )
                    )
                  }
                />
                <button className="saas-ghost-btn" onClick={() => setSelectedRoleId(role.id)}>
                  Gérer perms
                </button>
                <button className="saas-primary-btn" onClick={() => void updateRole(role)}>
                  Enregistrer
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card p-5">
          <h3 className="text-lg font-semibold text-[#fff0de]">Permissions par rôle</h3>

          <form onSubmit={createPermission} className="mt-4 flex gap-2">
            <input
              className="saas-input flex-1"
              placeholder="Ex: members.edit"
              value={newPermissionName}
              onChange={(event) => setNewPermissionName(event.target.value)}
              required
            />
            <button type="submit" className="saas-primary-btn">
              Ajouter
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {MODULE_SUGGESTIONS.map((item) => (
              <button key={item} className="saas-ghost-btn text-xs" onClick={() => setNewPermissionName(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#513420]/45 p-3">
            <p className="text-sm text-[#ffe5ca]">
              Rôle sélectionné : <span className="font-semibold">{selectedRole?.name ?? 'Aucun'}</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {permissions.map((permission) => {
                const active = selectedPermissionIds.includes(permission.id);
                return (
                  <button
                    key={permission.id}
                    className={active ? 'permission-pill permission-pill-active' : 'permission-pill'}
                    onClick={() => toggleSelectedPermission(permission.id)}
                  >
                    {permission.name}
                  </button>
                );
              })}
            </div>

            <button className="saas-primary-btn mt-4" onClick={() => void saveSelectedRolePermissions()}>
              Enregistrer permissions du rôle
            </button>
          </div>
        </article>
      </section>

      {memberModalOpen ? (
        <CreateMemberModal
          roles={roles.map((role) => ({ id: role.id, name: role.name }))}
          onClose={() => setMemberModalOpen(false)}
          onCreated={loadAll}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass-card p-5 smooth-hover">
      <p className="text-xs uppercase tracking-[0.15em] text-[#ffe2c2]/80">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#fff3e2]">{value}</p>
    </article>
  );
}
