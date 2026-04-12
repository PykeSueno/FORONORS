'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CreateMemberModal } from '@/components/members/create-member-modal';

type Permission = { id: number; name: string };
type Role = { id: number; name: string; display_order: number; permission_ids: number[] };
type Member = { id: string; username: string; role_id: number | null; is_active: boolean };
type EditableMember = Member & { editingRoleId: number | null };

const MODULE_SUGGESTIONS = ['members.access', 'members.create', 'members.edit', 'roles.manage', 'dashboard.access'];

type MembersPageClientProps = { userPermissions: string[] };

export function MembersPageClient({ userPermissions }: MembersPageClientProps) {
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPermissionName, setNewPermissionName] = useState('');

  const canCreateMember = userPermissions.includes('members.create');
  const canEditMembers = userPermissions.includes('members.edit') || canCreateMember;
  const canManageRoles = userPermissions.includes('roles.manage');

  async function loadAll() {
    setLoading(true);

    const membersResponse = await fetch('/api/members');
    const membersData = (await membersResponse.json()) as { members?: Member[]; message?: string };

    const rolesResponse = await fetch('/api/roles');
    const rolesData = (await rolesResponse.json()) as { roles?: Role[]; message?: string };

    const permissionsResponse = canManageRoles ? await fetch('/api/permissions') : null;
    const permissionsData = permissionsResponse
      ? ((await permissionsResponse.json()) as { permissions?: Permission[]; message?: string })
      : { permissions: [] };

    if (!membersResponse.ok || !rolesResponse.ok || (permissionsResponse && !permissionsResponse.ok)) {
      setError(membersData.message ?? rolesData.message ?? permissionsData.message ?? 'Chargement impossible.');
      setLoading(false);
      return;
    }

    const loadedRoles = rolesData.roles ?? [];

    setMembers((membersData.members ?? []).map((member) => ({ ...member, editingRoleId: member.role_id })));
    setRoles(loadedRoles);
    setPermissions(permissionsData.permissions ?? []);

    if (loadedRoles.length > 0) {
      const roleId = selectedRoleId && loadedRoles.some((role) => role.id === selectedRoleId) ? selectedRoleId : loadedRoles[0].id;
      setSelectedRoleId(roleId);
      setSelectedPermissionIds(loadedRoles.find((role) => role.id === roleId)?.permission_ids ?? []);
    }

    setError('');
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.display_order - b.display_order), [roles]);

  async function saveMember(member: EditableMember) {
    const response = await fetch(`/api/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: member.editingRoleId, is_active: member.is_active })
    });

    if (!response.ok) {
      setError('Mise à jour membre impossible.');
      return;
    }
    await loadAll();
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lastOrder = sortedRoles.at(-1)?.display_order ?? 0;
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName, display_order: lastOrder + 10 })
    });

    if (!response.ok) {
      setError('Création rôle impossible.');
      return;
    }

    setNewRoleName('');
    await loadAll();
  }

  async function renameRole(roleId: number, name: string) {
    const response = await fetch(`/api/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      setError('Renommage rôle impossible.');
      return;
    }
    await loadAll();
  }

  async function deleteRole(roleId: number) {
    const response = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('Suppression rôle impossible.');
      return;
    }
    await loadAll();
  }

  async function moveRole(roleId: number, direction: 'up' | 'down') {
    const index = sortedRoles.findIndex((role) => role.id === roleId);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sortedRoles.length) return;

    const current = sortedRoles[index];
    const target = sortedRoles[swapIndex];

    await Promise.all([
      fetch(`/api/roles/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: target.display_order })
      }),
      fetch(`/api/roles/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: current.display_order })
      })
    ]);

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
      setError('Création permission impossible.');
      return;
    }

    setNewPermissionName('');
    await loadAll();
  }

  async function savePermissionsForRole() {
    if (!selectedRole) return;
    const response = await fetch(`/api/roles/${selectedRole.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_ids: selectedPermissionIds })
    });

    if (!response.ok) {
      setError('Enregistrement permissions impossible.');
      return;
    }

    await loadAll();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#fff1df]">Membres</h1>
        {canCreateMember ? (
          <button className="saas-primary-btn" onClick={() => setMemberModalOpen(true)}>
            Créer
          </button>
        ) : null}
      </div>

      {error ? <p className="rounded-xl border border-red-300/50 bg-red-500/15 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card overflow-hidden p-0">
        <div className="overflow-x-auto px-3 py-3">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[#ffe3c5]">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="rounded-xl border border-white/10 bg-[#5a3925]/55">
                  <td className="px-4 py-3 font-medium text-[#fff2de]">{member.username}</td>
                  <td className="px-4 py-3 text-[#ffe2c3]">{member.username.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    <select
                      className="saas-input w-52"
                      disabled={!canEditMembers}
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
                      {sortedRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {canEditMembers ? (
                      <button className="saas-ghost-btn" onClick={() => void saveMember(member)}>
                        Enregistrer
                      </button>
                    ) : (
                      <span className="text-xs text-[#ffe2c5]/70">Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? <p className="px-2 pt-2 text-xs text-[#ffe3c1]">Chargement...</p> : null}
        </div>
      </section>

      {canManageRoles ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <article className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff1dd]">Rôles</h2>
            <form onSubmit={createRole} className="mt-3 flex gap-2">
              <input className="saas-input flex-1" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nouveau rôle" required />
              <button type="submit" className="saas-primary-btn">
                Ajouter
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {sortedRoles.map((role, index) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  isFirst={index === 0}
                  isLast={index === sortedRoles.length - 1}
                  selected={selectedRoleId === role.id}
                  onSelect={() => {
                    setSelectedRoleId(role.id);
                    setSelectedPermissionIds(role.permission_ids);
                  }}
                  onRename={renameRole}
                  onDelete={deleteRole}
                  onMove={moveRole}
                />
              ))}
            </div>
          </article>

          <article className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff1dd]">Permissions du rôle</h2>
            <p className="mt-1 text-sm text-[#ffe3c5]">{selectedRole ? selectedRole.name : 'Sélectionnez un rôle'}</p>

            <form onSubmit={createPermission} className="mt-3 flex gap-2">
              <input className="saas-input flex-1" placeholder="Ex: members.access" value={newPermissionName} onChange={(e) => setNewPermissionName(e.target.value)} required />
              <button type="submit" className="saas-primary-btn">Ajouter</button>
            </form>

            <div className="mt-2 flex flex-wrap gap-2">
              {MODULE_SUGGESTIONS.map((item) => (
                <button key={item} className="saas-ghost-btn text-xs" onClick={() => setNewPermissionName(item)}>
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {permissions.map((permission) => {
                const active = selectedPermissionIds.includes(permission.id);
                return (
                  <button
                    key={permission.id}
                    className={active ? 'permission-pill permission-pill-active' : 'permission-pill'}
                    onClick={() =>
                      setSelectedPermissionIds((current) =>
                        current.includes(permission.id)
                          ? current.filter((id) => id !== permission.id)
                          : [...current, permission.id]
                      )
                    }
                  >
                    {permission.name}
                  </button>
                );
              })}
            </div>

            <button className="saas-primary-btn mt-4" onClick={() => void savePermissionsForRole()}>
              Enregistrer permissions
            </button>
          </article>
        </section>
      ) : null}

      {memberModalOpen ? (
        <CreateMemberModal
          roles={sortedRoles.map((role) => ({ id: role.id, name: role.name }))}
          onClose={() => setMemberModalOpen(false)}
          onCreated={loadAll}
        />
      ) : null}
    </div>
  );
}

function RoleRow({
  role,
  isFirst,
  isLast,
  selected,
  onSelect,
  onRename,
  onDelete,
  onMove
}: {
  role: Role;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  onSelect: () => void;
  onRename: (roleId: number, name: string) => Promise<void>;
  onDelete: (roleId: number) => Promise<void>;
  onMove: (roleId: number, direction: 'up' | 'down') => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);

  useEffect(() => setName(role.name), [role.name]);

  return (
    <div className={selected ? 'rounded-xl border border-[#ffe3c2]/45 bg-[#724b30]/45 p-3' : 'rounded-xl border border-white/10 bg-[#5e3c26]/45 p-3'}>
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <input className="saas-input flex-1" value={name} onChange={(e) => setName(e.target.value)} />
        ) : (
          <p className="flex-1 font-medium text-[#fff2df]">{role.name}</p>
        )}

        <button className="saas-ghost-btn" onClick={onSelect}>Gérer permissions</button>

        {editing ? (
          <button className="saas-primary-btn" onClick={() => void onRename(role.id, name).then(() => setEditing(false))}>Valider</button>
        ) : (
          <button className="saas-ghost-btn" onClick={() => setEditing(true)}>Modifier</button>
        )}

        <button className="saas-ghost-btn" disabled={isFirst} onClick={() => void onMove(role.id, 'up')}>Monter</button>
        <button className="saas-ghost-btn" disabled={isLast} onClick={() => void onMove(role.id, 'down')}>Descendre</button>
        <button className="saas-ghost-btn" onClick={() => void onDelete(role.id)}>Supprimer</button>
      </div>
    </div>
  );
}
