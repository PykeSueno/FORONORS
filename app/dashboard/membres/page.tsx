'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CreateMemberModal } from '@/components/members/create-member-modal';

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

const MODULE_SUGGESTIONS = ['dashboard.view', 'members.view', 'members.create', 'members.edit', 'roles.manage'];

export default function MembersPage() {
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
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#f6e5cd]">Membres</h1>
            <p className="mt-1 text-sm text-[#d7ba99]">Gestion des utilisateurs, rôles et permissions de modules.</p>
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

      {error ? <p className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <section className="glass-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-[#f5e2c7]">Table des membres</h2>
          {loading ? <span className="text-xs text-[#cfae8a]">Chargement...</span> : null}
        </div>

        <div className="overflow-x-auto px-3 pb-3 pt-2">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[#d6b896]">
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="rounded-xl border border-white/10 bg-[#22170f]/70 transition duration-200 hover:bg-[#2c1d13]/90 hover:shadow-[0_0_20px_rgba(140,90,50,0.2)]">
                  <td className="px-4 py-3 text-[#f4e0c3]">{member.username}</td>
                  <td className="px-4 py-3">
                    <select
                      className="saas-input w-44"
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
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="glass-card p-5">
          <h3 className="text-lg font-semibold text-[#f5e2c7]">Rôles</h3>
          <form onSubmit={createRole} className="mt-4 flex gap-2">
            <input
              className="saas-input flex-1"
              placeholder="Ex: Admin"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              required
            />
            <button type="submit" className="saas-primary-btn">
              Ajouter
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-xl border border-white/10 bg-[#241910]/65 p-3">
                <p className="text-sm font-medium text-[#f2ddbf]">{role.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {permissions.map((permission) => {
                    const assigned = role.permission_ids.includes(permission.id);
                    return (
                      <button
                        key={`${role.id}-${permission.id}`}
                        onClick={() => void toggleRolePermission(role, permission.id)}
                        className={assigned ? 'permission-pill permission-pill-active' : 'permission-pill'}
                      >
                        {permission.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card p-5">
          <h3 className="text-lg font-semibold text-[#f5e2c7]">Permissions (modules)</h3>
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <div key={permission.id} className="rounded-xl border border-white/10 bg-[#241910]/65 px-3 py-2 text-xs text-[#e2c6a6]">
                {permission.name}
              </div>
            ))}
          </div>
        </article>
      </section>

      {memberModalOpen ? (
        <CreateMemberModal roles={roles.map((role) => ({ id: role.id, name: role.name }))} onClose={() => setMemberModalOpen(false)} onCreated={loadAll} />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass-card p-5 smooth-hover">
      <p className="text-xs uppercase tracking-[0.15em] text-[#d7ba98]/75">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#f6e4cc]">{value}</p>
    </article>
  );
}
