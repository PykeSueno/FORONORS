'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CreateMemberModal } from '@/components/members/create-member-modal';

type Permission = { id: number; name: string };
type Role = { id: number; name: string; display_order: number; permission_ids: number[] };
type Member = {
  id: string;
  name: string;
  username: string;
  role_id: number | null;
  role_name: string;
  is_active: boolean;
};

type MembersPageClientProps = {
  initialMembers: Member[];
  initialRoles: Role[];
  initialPermissions: Permission[];
  userPermissions: string[];
};

export function MembersPageClient({
  initialMembers,
  initialRoles,
  initialPermissions,
  userPermissions
}: MembersPageClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(initialRoles[0]?.id ?? null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(initialRoles[0]?.permission_ids ?? []);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newPermissionName, setNewPermissionName] = useState('');
  const [dragRoleId, setDragRoleId] = useState<number | null>(null);

  const canCreateMember = userPermissions.includes('members.create');
  const canEditMembers = userPermissions.includes('members.edit');
  const canDeleteMembers = userPermissions.includes('members.delete');
  const canManageRoles = userPermissions.includes('roles.manage');

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  const permissionsByCategory = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
      const category = permission.name.includes('.') ? permission.name.split('.')[0] : 'global';
      if (!acc[category]) acc[category] = [];
      acc[category].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  async function refreshAll() {
    const [membersRes, rolesRes, permsRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/roles'),
      canManageRoles ? fetch('/api/permissions') : Promise.resolve(null)
    ]);

    if (!membersRes.ok || !rolesRes.ok || (permsRes && !permsRes.ok)) {
      setError('Chargement impossible.');
      return;
    }

    const membersData = (await membersRes.json()) as { members: Member[] };
    const rolesData = (await rolesRes.json()) as { roles: Role[] };

    setMembers(membersData.members);
    setRoles(rolesData.roles);

    if (permsRes) {
      const permsData = (await permsRes.json()) as { permissions: Permission[] };
      setPermissions(permsData.permissions);
    }

    if (rolesData.roles.length) {
      const role = rolesData.roles.find((item) => item.id === selectedRoleId) ?? rolesData.roles[0];
      setSelectedRoleId(role.id);
      setSelectedPermissionIds(role.permission_ids);
    }
  }

  async function saveMember(member: Member, payload: { password?: string }) {
    const response = await fetch(`/api/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: member.name,
        username: member.username,
        role_id: member.role_id,
        is_active: member.is_active,
        password: payload.password || undefined
      })
    });

    if (!response.ok) {
      setError('Mise à jour membre impossible.');
      return;
    }

    setEditingMember(null);
    await refreshAll();
  }

  async function removeMember(memberId: string) {
    const response = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('Suppression membre impossible.');
      return;
    }
    await refreshAll();
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayOrder = (roles.at(-1)?.display_order ?? 0) + 10;
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName, display_order: displayOrder })
    });

    if (!response.ok) {
      setError('Création rôle impossible.');
      return;
    }

    setNewRoleName('');
    await refreshAll();
  }

  async function renameRole(roleId: number, name: string) {
    const response = await fetch(`/api/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!response.ok) setError('Renommage rôle impossible.');
    await refreshAll();
  }

  async function deleteRole(roleId: number) {
    const response = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
    if (!response.ok) setError('Suppression rôle impossible.');
    await refreshAll();
  }

  async function saveRoleOrder(nextRoles: Role[]) {
    await Promise.all(
      nextRoles.map((role, index) =>
        fetch(`/api/roles/${role.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: (index + 1) * 10 })
        })
      )
    );
    await refreshAll();
  }

  async function createPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPermissionName })
    });
    if (!response.ok) setError('Création permission impossible.');
    setNewPermissionName('');
    await refreshAll();
  }

  async function saveRolePermissions() {
    if (!selectedRole) return;
    const response = await fetch(`/api/roles/${selectedRole.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_ids: selectedPermissionIds })
    });

    if (!response.ok) setError('Enregistrement permissions impossible.');
    await refreshAll();
  }

  const sortedRoles = [...roles].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#fff1df]">Membres / Rôles / Permissions</h1>
        {canCreateMember ? <button className="saas-primary-btn" onClick={() => setShowCreateModal(true)}>Nouveau membre</button> : null}
      </div>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-4">
        <div className="grid gap-3">
          {members.map((member) => (
            <div key={member.id} className="rounded-xl border border-white/10 bg-[#5f3d26]/55 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_220px_auto] sm:items-center">
                <div>
                  <p className="text-sm text-[#ffe6cb]">Nom</p>
                  <p className="font-medium text-[#fff3df]">{member.name}</p>
                </div>
                <div>
                  <p className="text-sm text-[#ffe6cb]">User</p>
                  <p className="font-medium text-[#fff3df]">{member.username}</p>
                </div>
                <div>
                  <p className="text-sm text-[#ffe6cb]">Rôle</p>
                  <p className="font-medium text-[#fff3df]">{member.role_name || 'Sans rôle'}</p>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  {canEditMembers ? <button className="saas-ghost-btn" onClick={() => setEditingMember(member)}>Modifier</button> : null}
                  {canDeleteMembers ? <button className="saas-ghost-btn" onClick={() => void removeMember(member.id)}>Supprimer</button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {canManageRoles ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          <article className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff2df]">Rôles</h2>
            <form onSubmit={createRole} className="mt-3 flex gap-2">
              <input className="saas-input flex-1" placeholder="Nom du rôle" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
              <button className="saas-primary-btn" type="submit">Créer</button>
            </form>

            <div className="mt-4 space-y-2">
              {sortedRoles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  active={selectedRoleId === role.id}
                  onSelect={() => {
                    setSelectedRoleId(role.id);
                    setSelectedPermissionIds(role.permission_ids);
                  }}
                  onRename={renameRole}
                  onDelete={deleteRole}
                  onDragStart={() => setDragRoleId(role.id)}
                  onDrop={() => {
                    if (!dragRoleId || dragRoleId === role.id) return;
                    const items = [...sortedRoles];
                    const from = items.findIndex((r) => r.id === dragRoleId);
                    const to = items.findIndex((r) => r.id === role.id);
                    const [moved] = items.splice(from, 1);
                    items.splice(to, 0, moved);
                    void saveRoleOrder(items);
                  }}
                />
              ))}
            </div>
          </article>

          <article className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff2df]">Permissions par rôle</h2>
            <p className="mt-1 text-sm text-[#ffe5c6]">{selectedRole?.name ?? 'Sélectionnez un rôle'}</p>

            <form onSubmit={createPermission} className="mt-3 flex gap-2">
              <input className="saas-input flex-1" placeholder="Nouvelle permission" value={newPermissionName} onChange={(e) => setNewPermissionName(e.target.value)} required />
              <button className="saas-primary-btn" type="submit">Ajouter</button>
            </form>

            <div className="mt-4 space-y-4">
              {Object.entries(permissionsByCategory).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#ffe1bd]">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((permission) => {
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
                </div>
              ))}
            </div>

            <button className="saas-primary-btn mt-4" onClick={() => void saveRolePermissions()}>
              Enregistrer permissions
            </button>
          </article>
        </section>
      ) : null}

      {showCreateModal ? <CreateMemberModal roles={sortedRoles.map((r) => ({ id: r.id, name: r.name }))} onClose={() => setShowCreateModal(false)} onCreated={refreshAll} /> : null}
      {editingMember ? (
        <EditMemberDrawer member={editingMember} roles={sortedRoles} onClose={() => setEditingMember(null)} onSave={saveMember} />
      ) : null}
    </div>
  );
}

function RoleCard({
  role,
  active,
  onSelect,
  onRename,
  onDelete,
  onDragStart,
  onDrop
}: {
  role: Role;
  active: boolean;
  onSelect: () => void;
  onRename: (roleId: number, name: string) => Promise<void>;
  onDelete: (roleId: number) => Promise<void>;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={active ? 'rounded-xl border border-[#ffddb4]/40 bg-[#6e462c]/45 p-3' : 'rounded-xl border border-white/10 bg-[#5b3a25]/45 p-3'}
    >
      <div className="flex flex-wrap items-center gap-2">
        {editing ? <input className="saas-input flex-1" value={name} onChange={(e) => setName(e.target.value)} /> : <p className="flex-1 text-[#fff2df]">{role.name}</p>}
        <button className="saas-ghost-btn" onClick={onSelect}>Gérer</button>
        {editing ? (
          <button className="saas-primary-btn" onClick={() => void onRename(role.id, name).then(() => setEditing(false))}>OK</button>
        ) : (
          <button className="saas-ghost-btn" onClick={() => setEditing(true)}>Renommer</button>
        )}
        <button className="saas-ghost-btn" onClick={() => void onDelete(role.id)}>Supprimer</button>
      </div>
    </div>
  );
}

function EditMemberDrawer({
  member,
  roles,
  onClose,
  onSave
}: {
  member: Member;
  roles: Role[];
  onClose: () => void;
  onSave: (member: Member, payload: { password?: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Member>(member);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <div className="h-full w-full max-w-md bg-[#4b2f1e] p-5 text-[#ffe8cb] shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Modifier membre</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <div className="space-y-3">
          <input className="saas-input w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nom" />
          <input className="saas-input w-full" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} placeholder="User" />
          <select className="saas-input w-full" value={draft.role_id ?? ''} onChange={(e) => setDraft({ ...draft, role_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sans rôle</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Actif</label>

          <div className="relative">
            <input
              className="saas-input w-full pr-11"
              type={showPassword ? 'text' : 'password'}
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 saas-ghost-btn !px-2 !py-1" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button className="saas-primary-btn w-full" onClick={() => void onSave(draft, { password: newPassword })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
