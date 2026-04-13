'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

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


const PERMISSION_LABELS: Record<string, { module: string; label: string }> = {
  'dashboard.access': { module: 'Dashboard', label: 'Accès au dashboard' },
  'dashboard.view': { module: 'Dashboard', label: 'Voir les bulles du dashboard' },
  'members.access': { module: 'Membres', label: 'Accéder à la page Membres' },
  'members.create': { module: 'Membres', label: 'Créer un membre' },
  'members.edit': { module: 'Membres', label: 'Modifier un membre' },
  'members.delete': { module: 'Membres', label: 'Supprimer un membre' },
  'members.activities.view': { module: 'Membres', label: 'Voir les activités d’un membre' },
  'money.access': { module: 'Argent', label: 'Accéder au module Argent' },
  'money.view': { module: 'Argent', label: 'Voir les mouvements d’argent' },
  'money.edit': { module: 'Argent', label: 'Créer un mouvement d’argent' },
  'items.access': { module: 'Items', label: 'Accéder à la page Items' },
  'items.view': { module: 'Items', label: 'Voir les items' },
  'items.create': { module: 'Items', label: 'Créer un item' },
  'items.edit': { module: 'Items', label: 'Modifier un item' },
  'items.delete': { module: 'Items', label: 'Supprimer un item' },
  'transactions.access': { module: 'Transactions', label: 'Accéder au module Transactions' },
  'transactions.view': { module: 'Transactions', label: 'Voir les transactions' },
  'transactions.create': { module: 'Transactions', label: 'Créer une transaction' },
  'transactions.recent.access': { module: 'Transactions récentes', label: 'Accéder aux transactions récentes' },
  'transactions.recent.edit': { module: 'Transactions récentes', label: 'Modifier une transaction récente' },
  'transactions.recent.cancel': { module: 'Transactions récentes', label: 'Annuler une transaction récente' },
  'logs.access': { module: 'Logs', label: 'Accéder au module Logs' },
  'logs.view': { module: 'Logs', label: 'Voir les logs' },
  'tablet.access': { module: 'Tablette', label: 'Accéder à la page Tablette' },
  'tablet.passage.create': { module: 'Tablette', label: 'Créer un passage tablette' },
  'tablet.daily.manage': { module: 'Tablette', label: 'Gérer le dépôt du matin' },
  'tablet.stats.view': { module: 'Tablette', label: 'Voir les stats tablette' },
  'activity.access': { module: 'Activité', label: 'Accéder à la page Activité' },
  'activity.create': { module: 'Activité', label: 'Créer une activité' },
  'activity.edit': { module: 'Activité', label: 'Modifier une activité récente' },
  'activity.cancel': { module: 'Activité', label: 'Annuler une activité récente' },
  'activity.view': { module: 'Activité', label: 'Voir les activités récentes' },
  'activity.stats.view': { module: 'Activité', label: 'Voir les stats activité' },
  'account.password.edit': { module: 'Compte', label: 'Modifier un mot de passe' },
  'roles.manage': { module: 'Rôles', label: 'Gérer les rôles et permissions' }
};

function humanPermission(permission: Permission) {
  return PERMISSION_LABELS[permission.name] ?? { module: 'Autres', label: permission.name.replace(/\./g, ' · ') };
}

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
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [error, setError] = useState('');

  const canCreateMember = userPermissions.includes('members.create');
  const canEditMembers = userPermissions.includes('members.edit');
  const canDeleteMembers = userPermissions.includes('members.delete');
  const canManageRoles = userPermissions.includes('roles.manage');
  const canViewActivities = userPermissions.includes('members.activities.view');

  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.display_order - b.display_order), [roles]);

  async function refreshAll() {
    const [membersRes, rolesRes, permissionsRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/roles'),
      canManageRoles ? fetch('/api/permissions') : Promise.resolve(null)
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

  async function openCreateMember() {
    setSelectedMember({
      id: '',
      name: '',
      username: '',
      role_id: null,
      role_name: '',
      is_active: true
    });
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#fff2de]">Membres & Rôles</h1>
          {canCreateMember ? <button className="saas-primary-btn" onClick={() => void openCreateMember()}>Nouveau membre</button> : null}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff0d9]">Membres</h2>
        <div className="mt-3 space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#5b3924]/55 px-4 py-3">
              <div className="grid min-w-[280px] flex-1 grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[#ffe2c1]/80">Nom</p>
                  <p className="font-medium text-[#fff3df]">{member.name}</p>
                </div>
                <div>
                  <p className="text-[#ffe2c1]/80">User</p>
                  <p className="font-medium text-[#fff3df]">{member.username}</p>
                </div>
                <div>
                  <p className="text-[#ffe2c1]/80">Rôle</p>
                  <p className="font-medium text-[#fff3df]">{member.role_name || 'Sans rôle'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canViewActivities ? (
                  <Link href={`/dashboard/membres/${member.id}/activites`} className="saas-ghost-btn">
                    Activités
                  </Link>
                ) : null}
                {(canEditMembers || canDeleteMembers) ? (
                  <button className="saas-ghost-btn" onClick={() => setSelectedMember(member)}>
                    Gérer
                  </button>
                ) : null}
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
                <button className="saas-ghost-btn" onClick={() => setSelectedRole(role)}>Gérer</button>
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
          onClose={() => setSelectedRole(null)}
          onSaved={async () => {
            setSelectedRole(null);
            await refreshAll();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function MemberManageModal({
  member,
  roles,
  canDelete,
  isCreateMode,
  onClose,
  onSaved,
  onError
}: {
  member: Member;
  roles: Role[];
  canDelete: boolean;
  isCreateMode: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(member);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const value = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setNewPassword(value);
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
        password: newPassword || undefined
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
    if (!response.ok) {
      onError('Suppression impossible.');
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff0db]">Gérer membre</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <div className="space-y-3">
          <input className="saas-input w-full" placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="saas-input w-full" placeholder="User" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
          <select className="saas-input w-full" value={draft.role_id ?? ''} onChange={(e) => setDraft({ ...draft, role_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sans rôle</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[#ffe3c1]"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Actif</label>

          <div>
            <p className="mb-1 text-xs text-[#ffe3c1]/80">Mot de passe actuel</p>
            <input className="saas-input w-full" value="••••••" readOnly />
          </div>

          <div className="relative">
            <input
              className="saas-input w-full pr-20"
              type={showPassword ? 'text' : 'password'}
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <button type="button" className="saas-ghost-btn !px-2 !py-1" onClick={() => setShowPassword((v) => !v)}>{showPassword ? '🙈' : '👁️'}</button>
              <button type="button" className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={generatePassword}>Gen</button>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {!isCreateMode && canDelete ? <button className="saas-ghost-btn" onClick={() => void remove()}>Supprimer</button> : null}
            <button className="saas-primary-btn" onClick={() => void save()}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleManageModal({
  role,
  permissions,
  onClose,
  onSaved,
  onError
}: {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(role.name);
  const [checked, setChecked] = useState<number[]>(role.permission_ids);
  const [newPermission, setNewPermission] = useState('');

  async function saveRole() {
    const response = await fetch(`/api/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permission_ids: checked })
    });

    if (!response.ok) {
      onError('Enregistrement rôle impossible.');
      return;
    }

    await onSaved();
  }

  async function removeRole() {
    const response = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    if (!response.ok) {
      onError('Suppression rôle impossible.');
      return;
    }
    await onSaved();
  }

  async function addPermission() {
    const response = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPermission })
    });

    if (!response.ok) {
      onError('Création permission impossible.');
      return;
    }

    setNewPermission('');
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff0db]">Gérer rôle</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1">
          <input className="saas-input w-full" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="space-y-3">
            {Object.entries(permissions.reduce((acc, permission) => {
              const info = humanPermission(permission);
              if (!acc[info.module]) acc[info.module] = [];
              acc[info.module].push(permission);
              return acc;
            }, {} as Record<string, Permission[]>)).map(([moduleName, modulePermissions]) => (
              <section key={moduleName} className="rounded-xl border border-white/10 bg-[#4f3220]/45 p-3">
                <h4 className="text-sm font-semibold text-[#ffe9ce]">{moduleName}</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {modulePermissions.map((permission) => {
                    const info = humanPermission(permission);
                    return (
                      <label key={permission.id} className="rounded-lg border border-white/10 bg-[#5c3b26]/45 px-3 py-2 text-sm text-[#fff1de]">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={checked.includes(permission.id)}
                            onChange={(e) =>
                              setChecked((current) =>
                                e.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id)
                              )
                            }
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
            <button className="saas-primary-btn" onClick={() => void saveRole()}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
