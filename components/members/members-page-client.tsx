'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  SIMPLE_PERMISSION_MODULES,
  SIMPLE_ROLE_PRESETS,
  permissionsForSimpleKeys
} from '@/lib/permission-catalog';
import { toCanonicalPermission } from '@/lib/permission-normalization';
import { sortMembersByGrade } from '@/lib/members';
import { formatUsd } from '@/lib/currency';
import { RemoveLineButton } from '@/components/shared/line-controls';

type Permission = { id: number; name: string };
type Role = { id: number; name: string; display_order: number; permission_ids: number[] };
type Member = {
  id: string;
  name: string;
  username: string;
  iban_rib: string | null;
  role_id: number | null;
  role_name: string;
  is_active: boolean;
};

type MembersPageClientProps = {
  initialMembers: Member[];
  initialRoles: Role[];
  initialPermissions: Permission[];
  userPermissions: string[];
  expenseSummaries: Record<string, { pendingTotal: number; reimbursedTotal: number }>;
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

export function MembersPageClient({ initialMembers, initialRoles, initialPermissions, userPermissions, expenseSummaries }: MembersPageClientProps) {
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
  const canViewMemberPassword = userPermissions.includes('members.password.view');
  const canCopyMemberPassword = userPermissions.includes('members.password.copy');
  const canCopyCredentials = userPermissions.includes('members.credentials.copy');
  const canEditMemberPassword = userPermissions.includes('members.password.edit');
  const canRenameRole = userPermissions.includes('roles.rename');
  const canViewExpenses = userPermissions.includes('expenses.view');

  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.display_order - b.display_order), [roles]);
  const sortedMembers = useMemo(() => sortMembersByGrade(members), [members]);
  const selectedRoles = useMemo(() => sortedRoles.filter((role) => selectedRoleIds.includes(role.id)), [selectedRoleIds, sortedRoles]);
  const permissionNameById = useMemo(() => new Map(permissions.map((permission) => [permission.id, toCanonicalPermission(permission.name)])), [permissions]);
  const roleSummaries = useMemo(() => {
    const simpleActions = SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => ({
      moduleKey: module.key,
      permissionNames: permission.permissions.map(toCanonicalPermission)
    })));
    const totalActions = simpleActions.length;

    return new Map(sortedRoles.map((role) => {
      const roleNames = new Set(role.permission_ids.map((permissionId) => permissionNameById.get(permissionId)).filter(Boolean) as string[]);
      const enabledActions = simpleActions.filter((action) => action.permissionNames.some((permissionName) => roleNames.has(permissionName)));
      const completeModules = SIMPLE_PERMISSION_MODULES.filter((module) => {
        const moduleActions = simpleActions.filter((action) => action.moduleKey === module.key);
        return moduleActions.length > 0 && moduleActions.every((action) => action.permissionNames.some((permissionName) => roleNames.has(permissionName)));
      }).length;
      const ratio = totalActions > 0 ? Math.round((enabledActions.length / totalActions) * 100) : 0;
      const roleName = role.name.trim().toUpperCase();
      const headline = roleName === 'ADMIN' || roleName === 'PATRON'
        ? `${ratio}% accès`
        : roleName === 'PARTENAIRE'
          ? 'Accès partenaire sécurisé'
          : roleName === 'MEMBRE'
            ? 'Accès limité'
            : 'Accès gestion';
      const moneyAccess = enabledActions.some((action) => action.moduleKey === 'money' || action.moduleKey === 'member_ops');
      const detail = roleName === 'PARTENAIRE'
        ? 'FOUR partenaire, missions, planning et stock autorisé'
        : moneyAccess
          ? `${completeModules} modules complets`
          : `${completeModules} modules, pas accès argent`;

      return [role.id, {
        headline,
        detail,
        internalCount: role.permission_ids.length
      }] as const;
    }));
  }, [permissionNameById, sortedRoles]);

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
          {canCreateMember ? <button className="saas-primary-btn" onClick={() => setSelectedMember({ id: '', name: '', username: '', iban_rib: '', role_id: null, role_name: '', is_active: true })}>Nouveau membre</button> : null}
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
              {canViewExpenses ? (
                <div className="min-w-[180px] rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]">
                  <p className="font-semibold text-[#ffe8ca]">Dépenses</p>
                  <p>En attente {formatUsd(expenseSummaries[member.id]?.pendingTotal ?? 0)}</p>
                  <p>Remboursé {formatUsd(expenseSummaries[member.id]?.reimbursedTotal ?? 0)}</p>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                {canCopyCredentials ? <button className="saas-ghost-btn" onClick={() => void copyMemberCredentials(member)}>Copier</button> : null}
                {(canEditMembers || canDeleteMembers) ? <button className="saas-ghost-btn" onClick={() => setSelectedMember(member)}>Gérer</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {(canManageRoles || canRenameRole) ? (
        <section className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#fff0d9]">Rôles</h2>
            {canManageRoles ? <form onSubmit={createRole} className="flex gap-2">
              <input className="saas-input" placeholder="Nouveau rôle" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
              <button type="submit" className="saas-primary-btn">Créer</button>
            </form> : null}
          </div>

          <div className="mt-3 space-y-2">
            {sortedRoles.map((role) => (
              <div key={role.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#5b3924]/55 px-4 py-3">
                <div>
                  <p className="font-medium text-[#fff2df]">{role.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#efcdab]">
                    <span className="rounded-full border border-white/10 bg-[#3b2418]/50 px-2 py-0.5 text-[#ffe3c4]">{roleSummaries.get(role.id)?.headline ?? 'Accès personnalisé'}</span>
                    <span>{roleSummaries.get(role.id)?.detail ?? 'Résumé indisponible'}</span>
                    <span>{roleSummaries.get(role.id)?.internalCount ?? role.permission_ids.length} permissions internes</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canRenameRole ? <button className="saas-ghost-btn" onClick={() => { setSelectedRoleIds([role.id]); setIsRoleModalOpen(true); }}>✏️ Modifier le nom</button> : null}
                  {canManageRoles ? <button
                    className={`saas-ghost-btn ${selectedRoleIds.includes(role.id) ? '!bg-[#6a452c]/70' : ''}`}
                    onClick={() => {
                      setSelectedRoleIds((current) => current.includes(role.id) ? current.filter((id) => id !== role.id) : [...current, role.id]);
                      setIsRoleModalOpen(false);
                    }}
                  >
                    {selectedRoleIds.includes(role.id) ? 'Retirer' : 'Sélectionner'}
                  </button> : null}
                </div>
              </div>
            ))}
          </div>
          {canManageRoles ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#3b2418]/55 px-3 py-2">
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
          </div> : null}
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
          canManageRoles={canManageRoles}
          canRenameRole={canRenameRole}
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
        iban_rib: draft.iban_rib,
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
          <input className="saas-input w-full" placeholder="IBAN / RIB" value={draft.iban_rib ?? ''} onChange={(e) => setDraft({ ...draft, iban_rib: e.target.value })} />
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

function isCriticalRoleName(name?: string) {
  return ['patron', 'lead', 'admin', 'administrateur'].includes((name ?? '').trim().toLowerCase());
}

function RoleManageModal({ selectedRoles, permissions, canManageRoles, canRenameRole, onClose, onSaved, onError }: { selectedRoles: Role[]; permissions: Permission[]; canManageRoles: boolean; canRenameRole: boolean; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void; }) {
  const displayPermissions = useMemo(() => {
    const byCanonical = new Map<string, Permission>();
    for (const permission of permissions) {
      const canonicalName = toCanonicalPermission(permission.name);
      const current = byCanonical.get(canonicalName);
      if (!current || permission.name === canonicalName) byCanonical.set(canonicalName, permission);
    }
    return Array.from(byCanonical.values());
  }, [permissions]);

  const [isSaving, setIsSaving] = useState(false);
  const renameTarget = selectedRoles.length === 1 ? selectedRoles[0] : null;
  const [roleNameDraft, setRoleNameDraft] = useState(renameTarget?.name ?? '');
  const [isRenaming, setIsRenaming] = useState(false);
  const [criticalConfirmChecked, setCriticalConfirmChecked] = useState(false);
  const [criticalConfirmName, setCriticalConfirmName] = useState('');
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const renameIsCritical = Boolean(renameTarget && (isCriticalRoleName(renameTarget.name) || isCriticalRoleName(roleNameDraft)));
  const renameConfirmed = !renameIsCritical || (criticalConfirmChecked && criticalConfirmName.trim() === renameTarget?.name);

  const permissionIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const permission of displayPermissions) map.set(toCanonicalPermission(permission.name), permission.id);
    return map;
  }, [displayPermissions]);

  const simpleModules = useMemo(() => SIMPLE_PERMISSION_MODULES.map((module) => ({
    ...module,
    permissions: module.permissions.map((simplePermission) => ({
      ...simplePermission,
      permissionIds: simplePermission.permissions
        .map((permissionName) => permissionIdByName.get(toCanonicalPermission(permissionName)))
        .filter((id): id is number => Number.isInteger(id))
    }))
  })), [permissionIdByName]);
  const simplePermissionByKey = useMemo(() => new Map(simpleModules.flatMap((module) => module.permissions.map((permission) => [permission.key, permission]))), [simpleModules]);

  function simpleKeysFromRoles(roles: Role[]) {
    return new Set(simpleModules.flatMap((module) => module.permissions.filter((permission) => (
      permission.permissionIds.length > 0 &&
      roles.length > 0 &&
      roles.every((role) => permission.permissionIds.every((permissionId) => role.permission_ids.includes(permissionId)))
    )).map((permission) => permission.key)));
  }

  function partialSimpleKeysFromRoles(roles: Role[]) {
    return new Set(simpleModules.flatMap((module) => module.permissions.filter((permission) => {
      if (permission.permissionIds.length === 0 || roles.length === 0) return false;
      const enabledCount = permission.permissionIds.filter((permissionId) => roles.every((role) => role.permission_ids.includes(permissionId))).length;
      return enabledCount > 0 && enabledCount < permission.permissionIds.length;
    }).map((permission) => permission.key)));
  }

  const [checkedSimpleKeys, setCheckedSimpleKeys] = useState<Set<string>>(() => simpleKeysFromRoles(selectedRoles));
  const [partialSimpleKeys, setPartialSimpleKeys] = useState<Set<string>>(() => partialSimpleKeysFromRoles(selectedRoles));
  const [exactPermissionIds, setExactPermissionIds] = useState<Set<number> | null>(null);

  useEffect(() => {
    setCheckedSimpleKeys(simpleKeysFromRoles(selectedRoles));
    setPartialSimpleKeys(partialSimpleKeysFromRoles(selectedRoles));
    setExactPermissionIds(null);
  }, [selectedRoles, simpleModules]);

  useEffect(() => {
    if (simpleModules.length === 0) return;
    setOpenModules((current) => {
      if (Object.keys(current).length > 0) return current;
      return Object.fromEntries(simpleModules.slice(0, 4).map((module) => [module.key, true]));
    });
  }, [simpleModules]);

  useEffect(() => {
    setRoleNameDraft(renameTarget?.name ?? '');
    setCriticalConfirmChecked(false);
    setCriticalConfirmName('');
  }, [renameTarget?.id, renameTarget?.name]);

  async function saveRole() {
    if (!canManageRoles) return;
    if (isSaving) return;
    setIsSaving(true);
    const permissionIds = exactPermissionIds
      ? Array.from(exactPermissionIds)
      : Array.from(new Set(
        permissionsForSimpleKeys(Array.from(checkedSimpleKeys))
          .map((permissionName) => permissionIdByName.get(toCanonicalPermission(permissionName)))
          .filter((id): id is number => Number.isInteger(id))
      ));
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
    if (!canManageRoles) return;
    if (selectedRoles.length !== 1) return onError('Suppression disponible uniquement avec un seul rôle sélectionné.');
    const response = await fetch(`/api/roles/${selectedRoles[0].id}`, { method: 'DELETE' });
    if (!response.ok) return onError('Suppression rôle impossible.');
    onClose();
    await onSaved();
  }

  function simpleKeyState(simpleKey: string) {
    const permission = simplePermissionByKey.get(simpleKey);
    if (!permission || permission.permissionIds.length === 0) return { checked: false, mixed: false };
    if (checkedSimpleKeys.has(simpleKey)) return { checked: true, mixed: false };
    return { checked: false, mixed: partialSimpleKeys.has(simpleKey) };
  }

  function moduleState(simpleKeys: string[]) {
    if (simpleKeys.length === 0) return { checked: false, mixed: false };
    const states = simpleKeys.map(simpleKeyState);
    const checkedCount = states.filter((state) => state.checked).length;
    const hasMixed = states.some((state) => state.mixed);
    return { checked: checkedCount === states.length, mixed: hasMixed || (checkedCount > 0 && checkedCount < states.length) };
  }

  function toggleSimplePermission(simpleKey: string, next: boolean) {
    setExactPermissionIds(null);
    setCheckedSimpleKeys((current) => {
      const updated = new Set(current);
      if (next) updated.add(simpleKey);
      else updated.delete(simpleKey);
      return updated;
    });
    setPartialSimpleKeys((current) => {
      const updated = new Set(current);
      updated.delete(simpleKey);
      return updated;
    });
  }

  function toggleModule(simpleKeys: string[], next: boolean) {
    setExactPermissionIds(null);
    setCheckedSimpleKeys((current) => {
      const updated = new Set(current);
      for (const simpleKey of simpleKeys) {
        if (next) updated.add(simpleKey);
        else updated.delete(simpleKey);
      }
      return updated;
    });
    setPartialSimpleKeys((current) => {
      const updated = new Set(current);
      for (const simpleKey of simpleKeys) updated.delete(simpleKey);
      return updated;
    });
  }

  function applySimpleKeys(simpleKeys: string[]) {
    setExactPermissionIds(null);
    setCheckedSimpleKeys(new Set(simpleKeys));
    setPartialSimpleKeys(new Set());
  }

  function copyFromRole(roleId: number) {
    const source = selectedRoles.find((role) => role.id === roleId);
    if (!source) return;
    setExactPermissionIds(new Set(source.permission_ids));
    setCheckedSimpleKeys(simpleKeysFromRoles([source]));
    setPartialSimpleKeys(partialSimpleKeysFromRoles([source]));
  }

  async function duplicateRole() {
    if (!canManageRoles || selectedRoles.length !== 1) return;
    const source = selectedRoles[0];
    const nextName = window.prompt('Nom du nouveau rôle', `${source.name} copie`);
    if (!nextName?.trim()) return;
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nextName.trim(), display_order: source.display_order + 1, copy_from_role_id: source.id })
    });
    if (!response.ok) return onError('Duplication rôle impossible.');
    await onSaved();
  }

  async function renameRole() {
    if (!canRenameRole || !renameTarget || isRenaming) return;
    const nextName = roleNameDraft.trim();
    if (!nextName) return onError('Nom du rôle requis.');
    if (nextName === renameTarget.name) return onError('Le nom est identique.');
    if (!renameConfirmed) return onError('Double confirmation requise pour ce rôle critique.');

    setIsRenaming(true);
    const response = await fetch(`/api/roles/${renameTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nextName, confirm_critical: renameIsCritical ? renameConfirmed : false })
    });
    setIsRenaming(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      return onError(data.message ?? 'Renommage du rôle impossible.');
    }
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

          {canRenameRole && renameTarget ? (
            <section className="rounded-xl border border-amber-200/15 bg-[#4f3220]/45 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#f5d8b5]">✏️ Modifier le nom</p>
                {renameIsCritical ? <span className="rounded-full border border-rose-200/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100">Rôle critique</span> : null}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input className="saas-input" value={roleNameDraft} onChange={(e) => setRoleNameDraft(e.target.value)} placeholder="Nouveau nom du rôle" />
                <button className="saas-primary-btn" disabled={isRenaming || !roleNameDraft.trim() || roleNameDraft.trim() === renameTarget.name || !renameConfirmed} onClick={() => void renameRole()}>
                  {isRenaming ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
              {renameIsCritical ? (
                <div className="mt-3 space-y-2 rounded-xl border border-rose-200/20 bg-rose-500/10 p-3">
                  <label className="flex items-center gap-2 text-xs text-[#ffe3c1]">
                    <input type="checkbox" checked={criticalConfirmChecked} onChange={(e) => setCriticalConfirmChecked(e.target.checked)} />
                    Je confirme le renommage de ce rôle critique.
                  </label>
                  <input className="saas-input text-xs" value={criticalConfirmName} onChange={(e) => setCriticalConfirmName(e.target.value)} placeholder={`Tape "${renameTarget.name}" pour confirmer`} />
                </div>
              ) : null}
            </section>
          ) : null}

          {canManageRoles ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#f5d8b5]">Rôles simplifiés</p>
                    <p className="text-xs text-[#efcba8]">Copie rapide, duplication et reset sécurisé.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(SIMPLE_ROLE_PRESETS) as Array<keyof typeof SIMPLE_ROLE_PRESETS>).map((preset) => (
                      <button key={preset} type="button" className="saas-ghost-btn !h-8 !px-3 !text-xs" onClick={() => applySimpleKeys(SIMPLE_ROLE_PRESETS[preset])}>
                        Reset {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRoles.map((role) => (
                    <button key={role.id} type="button" className="filter-pill" onClick={() => copyFromRole(role.id)}>
                      Copier {role.name}
                    </button>
                  ))}
                  {selectedRoles.length === 1 ? (
                    <button type="button" className="filter-pill" onClick={() => void duplicateRole()}>
                      Dupliquer rôle
                    </button>
                  ) : null}
                  <button type="button" className="filter-pill" onClick={() => applySimpleKeys([])}>
                    Tout retirer
                  </button>
                </div>
              </section>

              <div className="grid gap-3 lg:grid-cols-2">
                {simpleModules.map((module) => {
                  const moduleSimpleKeys = module.permissions.map((permission) => permission.key);
                  const state = moduleState(moduleSimpleKeys);
                  return (
                    <section key={module.key} className="rounded-xl border border-white/10 bg-[#4f3220]/45 p-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() => setOpenModules((current) => ({ ...current, [module.key]: !current[module.key] }))}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[#2f1d14]/65 text-lg">{module.icon}</span>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-[#ffe9ce]">{module.title}</h4>
                            <p className="truncate text-xs text-[#efcba8]">{module.description}</p>
                          </div>
                        </div>
                        <span className="text-xs text-[#efcba8]">{openModules[module.key] ? '-' : '+'}</span>
                      </button>

                      {openModules[module.key] ? (
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-[#3b2418]/55 px-3 py-2 text-sm text-[#fff1de]">
                            <span className="font-semibold">Tout le module</span>
                            <input
                              type="checkbox"
                              checked={state.checked}
                              ref={(el) => {
                                if (el) el.indeterminate = state.mixed;
                              }}
                              onChange={(event) => toggleModule(moduleSimpleKeys, event.target.checked)}
                            />
                          </label>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {module.permissions.map((simplePermission) => {
                              const state = simpleKeyState(simplePermission.key);
                              return (
                                <label key={simplePermission.key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#5c3b26]/45 px-3 py-2 text-sm text-[#fff1de]">
                                  <span className="font-medium">{simplePermission.label}</span>
                                  <input
                                    type="checkbox"
                                    checked={state.checked}
                                    disabled={simplePermission.permissionIds.length === 0}
                                    ref={(el) => {
                                      if (el) el.indeterminate = state.mixed;
                                    }}
                                    onChange={(event) => toggleSimplePermission(simplePermission.key, event.target.checked)}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>

            </div>
          ) : null}

          {canManageRoles ? <div className="flex justify-end gap-2">
            {selectedRoles.length === 1 ? <div className="flex items-center"><RemoveLineButton onClick={() => void removeRole()} title="Supprimer le rôle" /></div> : null}
            <button className="saas-primary-btn" disabled={isSaving} onClick={() => void saveRole()}>{isSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div> : null}
        </div>
      </div>
    </div>
  );
}
