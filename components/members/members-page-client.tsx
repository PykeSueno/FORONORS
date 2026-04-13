'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { describePermission, MODULE_ORDER, permissionOrder } from '@/lib/permission-catalog';

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

export function MembersPageClient({ initialMembers, initialRoles, initialPermissions, userPermissions }: MembersPageClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [error, setError] = useState('');

  const canCreateMember = userPermissions.includes('members.create');
  const canEditMembers = userPermissions.includes('members.edit');
  const canDeleteMembers = userPermissions.includes('members.delete');
  const canManageRoles = userPermissions.includes('roles.manage');
  const canViewActivities = userPermissions.includes('members.activities.view');
  const canViewMemberPassword = userPermissions.includes('members.password.view');
  const canCopyMemberPassword = userPermissions.includes('members.password.copy');
  const canEditMemberPassword = userPermissions.includes('members.password.edit');

  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.display_order - b.display_order), [roles]);
  const selectedRole = useMemo(() => sortedRoles.find((role) => role.id === selectedRoleId) ?? null, [selectedRoleId, sortedRoles]);

  async function refreshAll() {
    const [membersRes, rolesRes, permissionsRes] = await Promise.all([
      fetch('/api/members', { cache: 'no-store' }),
      fetch('/api/roles', { cache: 'no-store' }),
      canManageRoles ? fetch('/api/permissions', { cache: 'no-store' }) : Promise.resolve(null)
    ]);

    if (!membersRes.ok || !rolesRes.ok || (permissionsRes && !permissionsRes.ok)) {
      setError('Chargement impossible.');
      return;
    }

    const membersData = (await membersRes.json()) as { members: Member[] };
    const rolesData = (await rolesRes.json()) as { roles: Role[] };

    setMembers(membersData.members);
    setRoles(rolesData.roles);

    if (permissionsRes) {
      const permissionsData = (await permissionsRes.json()) as { permissions: Permission[] };
      setPermissions(permissionsData.permissions);
    }
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName, display_order: (sortedRoles.at(-1)?.display_order ?? 0) + 10 })
    });

    if (!response.ok) {
      setError('Création du rôle impossible.');
      return;
    }

    setNewRoleName('');
    await refreshAll();
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#fff2de]">Membres & Rôles</h1>
          {canCreateMember ? <button className="saas-primary-btn" onClick={() => setSelectedMember({ id: '', name: '', username: '', role_id: null, role_name: '', is_active: true })}>Nouveau membre</button> : null}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff0d9]">Membres</h2>
        <div className="mt-3 space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#5b3924]/55 px-4 py-3">
              <div className="grid min-w-[280px] flex-1 grid-cols-3 gap-3 text-sm">
                <div><p className="text-[#ffe2c1]/80">Nom</p><p className="font-medium text-[#fff3df]">{member.name}</p></div>
                <div><p className="text-[#ffe2c1]/80">User</p><p className="font-medium text-[#fff3df]">{member.username}</p></div>
                <div><p className="text-[#ffe2c1]/80">Rôle</p><p className="font-medium text-[#fff3df]">{member.role_name || 'Sans rôle'}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {canViewActivities ? <Link href={`/dashboard/membres/${member.id}/activites`} className="saas-ghost-btn">Activités</Link> : null}
                {(canEditMembers || canDeleteMembers) ? <button className="saas-ghost-btn" onClick={() => setSelectedMember(member)}>Gérer</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {canManageRoles ? (
        <section className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#fff0d9]">Rôles</h2>
            <form onSubmit={createRole} className="flex gap-2">
              <input className="saas-input" placeholder="Nouveau rôle" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
              <button type="submit" className="saas-primary-btn">Créer</button>
            </form>
          </div>

          <div className="mt-3 space-y-2">
            {sortedRoles.map((role) => (
              <div key={role.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#5b3924]/55 px-4 py-3">
                <p className="font-medium text-[#fff2df]">{role.name}</p>
                <button className="saas-ghost-btn" onClick={() => { if (selectedRoleId === null) setSelectedRoleId(role.id); }}>Gérer</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {selectedMember ? (
        <MemberManageModal
          member={selectedMember}
          roles={sortedRoles}
          canDelete={canDeleteMembers}
          canViewPassword={canViewMemberPassword}
          canCopyPassword={canCopyMemberPassword}
          canEditPassword={canEditMemberPassword}
          isCreateMode={!selectedMember.id}
          onClose={() => setSelectedMember(null)}
          onSaved={async () => {
            setSelectedMember(null);
            await refreshAll();
          }}
          onError={setError}
        />
      ) : null}

      {selectedRole ? (
        <RoleManageModal
          role={selectedRole}
          permissions={permissions}
          onClose={() => setSelectedRoleId(null)}
          onSaved={async (updatedRoleId) => {
            await refreshAll();
            setSelectedRoleId(updatedRoleId);
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function MemberManageModal({ member, roles, canDelete, canViewPassword, canCopyPassword, canEditPassword, isCreateMode, onClose, onSaved, onError }: { member: Member; roles: Role[]; canDelete: boolean; canViewPassword: boolean; canCopyPassword: boolean; canEditPassword: boolean; isCreateMode: boolean; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void; }) {
  const [draft, setDraft] = useState(member);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  useEffect(() => {
    async function loadCurrentPassword() {
      if (isCreateMode || !member.id || (!canViewPassword && !canCopyPassword)) {
        setCurrentPassword('');
        return;
      }

      const response = await fetch(`/api/members/${member.id}/password`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { password?: string };
      setCurrentPassword(data.password ?? '');
    }

    void loadCurrentPassword();
  }, [isCreateMode, member.id, canViewPassword, canCopyPassword]);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const value = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setNewPassword(value);
  }

  async function copyCurrentPassword() {
    if (!currentPassword) return;
    try {
      await navigator.clipboard.writeText(currentPassword);
      setCopyFeedback('Copié');
      setTimeout(() => setCopyFeedback(''), 1200);
    } catch {
      setCopyFeedback('Échec');
      setTimeout(() => setCopyFeedback(''), 1200);
    }
  }

  async function save() {
    const response = await fetch(isCreateMode ? '/api/members' : `/api/members/${draft.id}`, {
      method: isCreateMode ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        username: draft.username,
        role_id: draft.role_id,
        is_active: draft.is_active,
        password: canEditPassword ? (newPassword || undefined) : undefined
      })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      onError(data.message ?? 'Enregistrement impossible.');
      return;
    }

    await onSaved();
  }

  async function remove() {
    const response = await fetch(`/api/members/${draft.id}`, { method: 'DELETE' });
    if (!response.ok) return onError('Suppression impossible.');
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-semibold text-[#fff0db]">Gérer membre</h3><button className="saas-ghost-btn" onClick={onClose}>Fermer</button></div>
        <div className="space-y-3">
          <input className="saas-input w-full" placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="saas-input w-full" placeholder="User" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
          <select className="saas-input w-full" value={draft.role_id ?? ''} onChange={(e) => setDraft({ ...draft, role_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sans rôle</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-[#ffe3c1]"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Actif</label>

          {(canViewPassword || canCopyPassword) ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs text-[#ffe3c1]/80">Mot de passe actuel</p>
                <div className="flex items-center gap-1">
                  {canViewPassword ? <button type="button" className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => setShowCurrentPassword((v) => !v)}>{showCurrentPassword ? 'Masquer' : 'Afficher'}</button> : null}
                  {canCopyPassword ? <button type="button" className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => void copyCurrentPassword()}>Copier</button> : null}
                </div>
              </div>
              <input className="saas-input w-full" type={showCurrentPassword ? 'text' : 'password'} value={currentPassword || ''} readOnly />
              {copyFeedback ? <p className="mt-1 text-xs text-[#efcdab]">{copyFeedback}</p> : null}
            </div>
          ) : null}

          {canEditPassword ? (
            <div className="relative">
              <input className="saas-input w-full pr-20" type={showPassword ? 'text' : 'password'} placeholder="Nouveau mot de passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                <button type="button" className="saas-ghost-btn !px-2 !py-1" onClick={() => setShowPassword((v) => !v)}>{showPassword ? '🙈' : '👁️'}</button>
                <button type="button" className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={generatePassword}>Gen</button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {!isCreateMode && canDelete ? <button className="saas-ghost-btn" onClick={() => void remove()}>Supprimer</button> : null}
            <button className="saas-primary-btn" onClick={() => void save()}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleManageModal({ role, permissions, onClose, onSaved, onError }: { role: Role; permissions: Permission[]; onClose: () => void; onSaved: (roleId: number) => Promise<void>; onError: (message: string) => void; }) {
  const [name, setName] = useState(role.name);
  const [checked, setChecked] = useState<Record<number, boolean>>(() => Object.fromEntries(role.permission_ids.map((id) => [id, true])));
  const [newPermission, setNewPermission] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const modules = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    for (const permission of permissions) {
      const info = describePermission(permission.name);
      if (!grouped[info.module]) grouped[info.module] = [];
      grouped[info.module].push(permission);
    }

    return Object.entries(grouped)
      .sort(([moduleA], [moduleB]) => {
        const orderA = MODULE_ORDER.indexOf(moduleA as (typeof MODULE_ORDER)[number]);
        const orderB = MODULE_ORDER.indexOf(moduleB as (typeof MODULE_ORDER)[number]);
        const a = orderA === -1 ? MODULE_ORDER.length : orderA;
        const b = orderB === -1 ? MODULE_ORDER.length : orderB;
        return a - b || moduleA.localeCompare(moduleB, 'fr');
      })
      .map(([moduleName, modulePermissions]) => ({
        moduleName,
        permissions: [...modulePermissions].sort((a, b) => permissionOrder(a.name) - permissionOrder(b.name) || describePermission(a.name).label.localeCompare(describePermission(b.name).label, 'fr'))
      }));
  }, [permissions]);

  async function saveRole() {
    if (isSaving) return;
    setIsSaving(true);
    const permissionIds = permissions.filter((permission) => checked[permission.id]).map((permission) => permission.id);

    const response = await fetch(`/api/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), permission_ids: permissionIds })
    });

    setIsSaving(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      return onError(data.message ?? 'Enregistrement rôle impossible.');
    }
    await onSaved(role.id);
  }

  async function removeRole() {
    const response = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    if (!response.ok) return onError('Suppression rôle impossible.');
    onClose();
    await onSaved(-1);
  }

  async function addPermission() {
    const permissionName = newPermission.trim().toLowerCase();
    if (!permissionName) return;

    const response = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: permissionName })
    });

    if (!response.ok) return onError('Création permission impossible.');
    setNewPermission('');
    await onSaved(role.id);
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="glass-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff0db]">Gérer rôle</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1">
          <input className="saas-input w-full" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="space-y-3">
            {modules.map((module) => (
              <section key={module.moduleName} className="rounded-xl border border-white/10 bg-[#4f3220]/45 p-3">
                <h4 className="text-sm font-semibold text-[#ffe9ce]">{module.moduleName}</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {module.permissions.map((permission) => {
                    const info = describePermission(permission.name);
                    return (
                      <label key={permission.id} title={info.hint} className="rounded-lg border border-white/10 bg-[#5c3b26]/45 px-3 py-2 text-sm text-[#fff1de]">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(checked[permission.id])}
                            onChange={(e) => setChecked((current) => ({ ...current, [permission.id]: e.target.checked }))}
                          />
                          <div>
                            <p className="font-medium">{info.label}</p>
                            <p className="text-[11px] text-[#efcba8]">{permission.name}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="flex gap-2">
            <input className="saas-input flex-1" placeholder="Nouvelle permission" value={newPermission} onChange={(e) => setNewPermission(e.target.value)} />
            <button className="saas-ghost-btn" onClick={() => void addPermission()}>Ajouter</button>
          </div>

          <div className="flex justify-end gap-2">
            <button className="saas-ghost-btn" onClick={() => void removeRole()}>Supprimer rôle</button>
            <button className="saas-primary-btn" disabled={isSaving} onClick={() => void saveRole()}>{isSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
