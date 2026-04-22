'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { describePermission, MODULE_ORDER, SECTION_ORDER } from '@/lib/permission-catalog';
import { toCanonicalPermission } from '@/lib/permission-normalization';
import { sortMembersByGrade } from '@/lib/members';
import { RemoveLineButton } from '@/components/shared/line-controls';

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

function buildCredentialsMessage(username: string, password: string) {
  return `Voici le lien de la tablette : https://foronors.vercel.app/\n\nFais un glisser-déposer sur ta tablette IG puis colle cette URL pour y accéder directement en jeu.\n\nVoici tes identifiants :\n\nUser : ${username}\n\nMDP : ${password}\n\nSi tu veux changer ton mot de passe, clique sur la clé en haut à droite, à côté du bouton de déconnexion.`;
}

async function tryCopyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API unavailable (common in restricted webviews)
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function MembersPageClient({ initialMembers, initialRoles, initialPermissions, userPermissions }: MembersPageClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [error, setError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [copyFallbackText, setCopyFallbackText] = useState('');

  const canCreateMember = userPermissions.includes('members.create');
  const canEditMembers = userPermissions.includes('members.edit');
  const canDeleteMembers = userPermissions.includes('members.delete');
  const canManageRoles = userPermissions.includes('roles.manage');
  const canViewActivities = userPermissions.includes('members.activities.view');
  const canViewMemberPassword = userPermissions.includes('members.password.view');
  const canCopyMemberPassword = userPermissions.includes('members.password.copy');
  const canCopyCredentials = userPermissions.includes('members.credentials.copy');
  const canEditMemberPassword = userPermissions.includes('members.password.edit');

  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.display_order - b.display_order), [roles]);
  const sortedMembers = useMemo(() => sortMembersByGrade(members), [members]);
  const selectedRoles = useMemo(() => sortedRoles.filter((role) => selectedRoleIds.includes(role.id)), [selectedRoleIds, sortedRoles]);

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

  async function copyMemberCredentials(member: Member) {
    setCopyFallbackText('');
    setCopyFeedback('');
    const response = await fetch(`/api/members/${member.id}/password`, { cache: 'no-store' });
    if (!response.ok) {
      setCopyFeedback('Impossible de récupérer les identifiants.');
      setTimeout(() => setCopyFeedback(''), 2000);
      return;
    }
    const data = (await response.json()) as { password?: string };
    const password = data.password ?? '';
    if (!member.username || !password) {
      setCopyFeedback('Identifiants incomplets.');
      setTimeout(() => setCopyFeedback(''), 1800);
      return;
    }

    const text = buildCredentialsMessage(member.username, password);
    const copied = await tryCopyText(text);
    if (copied) {
      setCopyFeedback('Identifiants copiés');
      setTimeout(() => setCopyFeedback(''), 1600);
      return;
    }

    setCopyFallbackText(text);
    setCopyFeedback('Copie directe impossible, texte affiché ci-dessous');
    setTimeout(() => setCopyFeedback(''), 2400);
  }

  function selectAllFallbackText() {
    const el = document.getElementById('member-credentials-fallback') as HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    el.select();
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
      {copyFeedback ? <p className="rounded-xl border border-white/10 bg-[#4a2f20]/45 px-4 py-2 text-sm text-[#efcdab]">{copyFeedback}</p> : null}
      {copyFallbackText ? (
        <section className="glass-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-[#efcdab]">Copie manuelle</p>
            <button type="button" className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={selectAllFallbackText}>Sélectionner tout</button>
          </div>
          <textarea id="member-credentials-fallback" className="saas-input h-36 w-full resize-none text-xs leading-relaxed" readOnly value={copyFallbackText} />
        </section>
      ) : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff0d9]">Membres</h2>
        <div className="mt-3 space-y-2">
          {sortedMembers.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#5b3924]/55 px-4 py-3">
              <div className="grid min-w-[280px] flex-1 grid-cols-3 gap-3 text-sm">
                <div><p className="text-[#ffe2c1]/80">Nom</p><p className="font-medium text-[#fff3df]">{member.name}</p></div>
                <div><p className="text-[#ffe2c1]/80">User</p><p className="font-medium text-[#fff3df]">{member.username}</p></div>
                <div><p className="text-[#ffe2c1]/80">Rôle</p><p className="font-medium text-[#fff3df]">{member.role_name || 'Sans rôle'}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {canCopyCredentials ? <button className="saas-ghost-btn" onClick={() => void copyMemberCredentials(member)}>Copier</button> : null}
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
                <button
                  className={`saas-ghost-btn ${selectedRoleIds.includes(role.id) ? '!bg-[#6a452c]/70' : ''}`}
                  onClick={() => {
                    setSelectedRoleIds((current) => current.includes(role.id) ? current.filter((id) => id !== role.id) : [...current, role.id]);
                    setIsRoleModalOpen(false);
                  }}
                >
                  {selectedRoleIds.includes(role.id) ? 'Retirer' : 'Sélectionner'}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#3b2418]/55 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#f5d8b5]">Rôles sélectionnés</p>
              {selectedRoles.length === 0 ? <span className="text-xs text-[#efcdab]">Aucun</span> : selectedRoles.map((role) => (
                <span key={role.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#5e3b25]/70 px-2 py-1 text-xs text-[#ffe8ca]">
                  {role.name}
                  <button className="text-[#ffd6ac] hover:text-white" onClick={() => setSelectedRoleIds((current) => current.filter((id) => id !== role.id))}>✕</button>
                </span>
              ))}
            </div>
            <button className="saas-primary-btn" disabled={selectedRoles.length === 0} onClick={() => setIsRoleModalOpen(true)}>
              Gérer la sélection
            </button>
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
          canCopyCredentials={canCopyCredentials}
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

      {isRoleModalOpen && selectedRoles.length > 0 ? (
        <RoleManageModal
          selectedRoles={selectedRoles}
          permissions={permissions}
          onClose={() => setIsRoleModalOpen(false)}
          onSaved={async () => {
            await refreshAll();
            setIsRoleModalOpen(false);
            setSelectedRoleIds([]);
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function MemberManageModal({ member, roles, canDelete, canViewPassword, canCopyPassword, canCopyCredentials, canEditPassword, isCreateMode, onClose, onSaved, onError }: { member: Member; roles: Role[]; canDelete: boolean; canViewPassword: boolean; canCopyPassword: boolean; canCopyCredentials: boolean; canEditPassword: boolean; isCreateMode: boolean; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void; }) {
  const [draft, setDraft] = useState(member);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [copyFallbackText, setCopyFallbackText] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  useEffect(() => {
    async function loadCurrentPassword() {
      if (isCreateMode || !member.id || (!canViewPassword && !canCopyPassword && !canCopyCredentials)) {
        setCurrentPassword('');
        return;
      }

      const response = await fetch(`/api/members/${member.id}/password`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { password?: string };
      setCurrentPassword(data.password ?? '');
    }

    void loadCurrentPassword();
  }, [isCreateMode, member.id, canViewPassword, canCopyPassword, canCopyCredentials]);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const value = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setNewPassword(value);
  }

  async function copyTextRobust(text: string, successMessage: string) {
    setCopyFallbackText('');
    const copied = await tryCopyText(text);
    if (copied) {
      setCopyFeedback(successMessage);
      setTimeout(() => setCopyFeedback(''), 1400);
      return true;
    }

    setCopyFallbackText(text);
    setCopyFeedback('Copie directe impossible, texte affiché ci-dessous.');
    setTimeout(() => setCopyFeedback(''), 2400);
    return false;
  }

  async function copyCurrentPassword() {
    if (!currentPassword) return;
    await copyTextRobust(currentPassword, 'Mot de passe copié');
  }

  async function copyTabletAccessMessage() {
    const passwordValue = newPassword || currentPassword;
    if (!draft.username || !passwordValue) {
      setCopyFeedback('User/MDP manquant');
      setTimeout(() => setCopyFeedback(''), 1200);
      return;
    }
    const message = buildCredentialsMessage(draft.username, passwordValue);
    await copyTextRobust(message, 'Identifiants copiés');
  }

  function selectAllFallbackText() {
    const el = document.getElementById(`fallback-copy-${draft.id || 'new'}`) as HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    el.select();
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
            {!isCreateMode && canCopyCredentials ? <button className="saas-ghost-btn" onClick={() => void copyTabletAccessMessage()}>Copier</button> : null}
            {!isCreateMode && canDelete ? <div className="flex items-center"><RemoveLineButton onClick={() => void remove()} title="Supprimer le membre" /></div> : null}
            <button className="saas-primary-btn" onClick={() => void save()}>Enregistrer</button>
          </div>

          {copyFallbackText ? (
            <div className="rounded-xl border border-white/10 bg-[#4a2f20]/55 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-[#efcdab]">Copie manuelle (fallback)</p>
                <button type="button" className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={selectAllFallbackText}>Sélectionner tout</button>
              </div>
              <textarea
                id={`fallback-copy-${draft.id || 'new'}`}
                className="saas-input h-36 w-full resize-none text-xs leading-relaxed"
                readOnly
                value={copyFallbackText}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RoleManageModal({ selectedRoles, permissions, onClose, onSaved, onError }: { selectedRoles: Role[]; permissions: Permission[]; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void; }) {
  const displayPermissions = useMemo(() => {
    const byCanonical = new Map<string, Permission>();
    for (const permission of permissions) {
      const canonicalName = toCanonicalPermission(permission.name);
      const current = byCanonical.get(canonicalName);
      if (!current || permission.name === canonicalName) byCanonical.set(canonicalName, permission);
    }
    return Array.from(byCanonical.values());
  }, [permissions]);

  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    const allPermissionIds = displayPermissions.map((permission) => permission.id);
    return Object.fromEntries(allPermissionIds.map((permissionId) => [permissionId, selectedRoles.every((role) => role.permission_ids.includes(permissionId))]));
  });
  const [mixedPermissionIds] = useState<Set<number>>(() => {
    const allPermissionIds = displayPermissions.map((permission) => permission.id);
    return new Set(allPermissionIds.filter((permissionId) => {
      const withPermission = selectedRoles.filter((role) => role.permission_ids.includes(permissionId)).length;
      return withPermission > 0 && withPermission < selectedRoles.length;
    }));
  });
  const [newPermission, setNewPermission] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const modules = useMemo(() => {
    const grouped: Record<string, Record<string, Permission[]>> = {};
    for (const permission of displayPermissions) {
      const info = describePermission(permission.name);
      if (!grouped[info.module]) grouped[info.module] = {};
      if (!grouped[info.module][info.section]) grouped[info.module][info.section] = [];
      grouped[info.module][info.section].push(permission);
    }

    return Object.entries(grouped)
      .sort(([moduleA], [moduleB]) => {
        const orderA = MODULE_ORDER.indexOf(moduleA as (typeof MODULE_ORDER)[number]);
        const orderB = MODULE_ORDER.indexOf(moduleB as (typeof MODULE_ORDER)[number]);
        const a = orderA === -1 ? MODULE_ORDER.length : orderA;
        const b = orderB === -1 ? MODULE_ORDER.length : orderB;
        return a - b || moduleA.localeCompare(moduleB, 'fr');
      })
      .map(([moduleName, sectionMap]) => ({
        moduleName,
        sections: Object.entries(sectionMap)
          .sort(([sectionA], [sectionB]) => {
            const a = SECTION_ORDER.indexOf(sectionA as (typeof SECTION_ORDER)[number]);
            const b = SECTION_ORDER.indexOf(sectionB as (typeof SECTION_ORDER)[number]);
            const ai = a === -1 ? SECTION_ORDER.length : a;
            const bi = b === -1 ? SECTION_ORDER.length : b;
            return ai - bi || sectionA.localeCompare(sectionB, 'fr');
          })
          .map(([sectionName, sectionPermissions]) => ({
            sectionName,
            permissions: [...sectionPermissions].sort((a, b) => describePermission(a.name).label.localeCompare(describePermission(b.name).label, 'fr'))
          }))
      }));
  }, [displayPermissions]);

  useEffect(() => {
    if (modules.length === 0) return;
    setOpenModules((current) => {
      if (Object.keys(current).length > 0) return current;
      return { [modules[0].moduleName]: true };
    });
  }, [modules]);

  async function saveRole() {
    if (isSaving) return;
    setIsSaving(true);
    const permissionIds = displayPermissions.filter((permission) => checked[permission.id]).map((permission) => permission.id);
    const response = await fetch('/api/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_ids: selectedRoles.map((role) => role.id), permission_ids: permissionIds })
    });

    setIsSaving(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      return onError(data.message ?? 'Enregistrement rôle impossible.');
    }
    await onSaved();
  }

  async function removeRole() {
    if (selectedRoles.length !== 1) return onError('Suppression disponible uniquement avec un seul rôle sélectionné.');
    const response = await fetch(`/api/roles/${selectedRoles[0].id}`, { method: 'DELETE' });
    if (!response.ok) return onError('Suppression rôle impossible.');
    onClose();
    await onSaved();
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
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="glass-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff0db]">Gérer rôle{selectedRoles.length > 1 ? 's' : ''}</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#f5d8b5]">Rôles sélectionnés</p>
            <div className="flex flex-wrap gap-2">
              {selectedRoles.map((role) => (
                <span key={role.id} className="rounded-full border border-white/10 bg-[#5e3b25]/70 px-2 py-1 text-xs text-[#ffe8ca]">{role.name}</span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {modules.map((module) => (
              <section key={module.moduleName} className="rounded-xl border border-white/10 bg-[#4f3220]/45 p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setOpenModules((current) => ({ ...current, [module.moduleName]: !current[module.moduleName] }))}
                >
                  <h4 className="text-sm font-semibold text-[#ffe9ce]">{module.moduleName}</h4>
                  <span className="text-xs text-[#efcba8]">{openModules[module.moduleName] ? '−' : '+'}</span>
                </button>
                {openModules[module.moduleName] ? <div className="mt-3 space-y-3">
                  {module.sections.map((section) => (
                    <div key={`${module.moduleName}-${section.sectionName}`} className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-left"
                        onClick={() => {
                          const key = `${module.moduleName}-${section.sectionName}`;
                          setOpenSections((current) => ({ ...current, [key]: !current[key] }));
                        }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#f7d6ad]">{section.sectionName}</p>
                        <span className="text-[11px] text-[#efcba8]">{openSections[`${module.moduleName}-${section.sectionName}`] ? '−' : '+'}</span>
                      </button>
                      {openSections[`${module.moduleName}-${section.sectionName}`] ? <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {section.permissions.map((permission) => {
                          const info = describePermission(permission.name);
                          return (
                            <label key={permission.id} title={info.hint} className="rounded-lg border border-white/10 bg-[#5c3b26]/45 px-3 py-2 text-sm text-[#fff1de]">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checked[permission.id])}
                                  ref={(el) => {
                                    if (!el) return;
                                    el.indeterminate = mixedPermissionIds.has(permission.id) && !checked[permission.id];
                                  }}
                                  onChange={(e) => setChecked((current) => ({ ...current, [permission.id]: e.target.checked }))}
                                />
                                <div>
                                  <p className="font-medium">{info.label}</p>
                                  <p className="text-[11px] text-[#efcba8]">{info.hint}</p>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div> : null}
                    </div>
                  ))}
                </div> : null}
              </section>
            ))}
          </div>

          <div className="flex gap-2">
            <input className="saas-input flex-1" placeholder="Nouvelle permission" value={newPermission} onChange={(e) => setNewPermission(e.target.value)} />
            <button className="saas-ghost-btn" onClick={() => void addPermission()}>Ajouter</button>
          </div>

          <div className="flex justify-end gap-2">
            {selectedRoles.length === 1 ? <div className="flex items-center"><RemoveLineButton onClick={() => void removeRole()} title="Supprimer le rôle" /></div> : null}
            <button className="saas-primary-btn" disabled={isSaving} onClick={() => void saveRole()}>{isSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
