import { getSupabaseAdmin } from './supabase';
import { expandPermissionAliases, normalizePermissionNames } from './permission-normalization';
import { PERMISSION_LABELS } from './permission-catalog';

type PermissionRelation = { permissions: { name: string } | { name: string }[] | null };

const CACHE_TTL_MS = 15_000;
const permissionCache = new Map<string, { expiresAt: number; permissions: string[] }>();

const PARTNER_BLOCKED_PREFIXES = ['money.', 'payroll.', 'member_ops.', 'roles.', 'logs.', 'expenses.'];
const PARTNER_BLOCKED_EXACT = new Set([
  'dashboard.money.movements.preview',
  'dashboard.money.movements.access',
  'members.password.view',
  'members.password.copy',
  'members.password.edit',
  'members.credentials.copy'
]);

function enforcePartnerSafety(roleName: string, permissions: string[]) {
  if (roleName !== 'partenaire') return permissions;
  return permissions.filter((permission) => (
    !PARTNER_BLOCKED_EXACT.has(permission) &&
    !PARTNER_BLOCKED_PREFIXES.some((prefix) => permission.startsWith(prefix))
  ));
}

export async function getUserPermissions(userId: string) {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from('users').select('role_id, role').eq('id', userId).maybeSingle();

  let roleName = user?.role?.trim().toLowerCase() ?? '';
  if (!roleName && user?.role_id) {
    const { data: role } = await supabase.from('roles').select('name').eq('id', user.role_id).maybeSingle();
    roleName = role?.name?.trim().toLowerCase() ?? '';
  }

  if (roleName === 'patron') {
    const { data: allPermissions } = await supabase.from('permissions').select('name');
    const builtinPermissions = Object.keys(PERMISSION_LABELS);
    const canonical = normalizePermissionNames([...(allPermissions ?? []).map((item) => item.name), ...builtinPermissions]);
    const permissions = enforcePartnerSafety(roleName, Array.from(new Set(canonical.flatMap((permission) => expandPermissionAliases(permission)))));
    permissionCache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, permissions });
    return permissions;
  }

  if (!user?.role_id) return [] as string[];

  const { data } = await supabase.from('role_permissions').select('permissions(name)').eq('role_id', user.role_id);

  const rawPermissions = ((data ?? []) as PermissionRelation[])
    .map((item) => (Array.isArray(item.permissions) ? item.permissions[0]?.name : item.permissions?.name))
    .filter((value): value is string => Boolean(value));

  const canonical = normalizePermissionNames(rawPermissions);
  const expanded = canonical.flatMap((permission) => expandPermissionAliases(permission));
  const permissions = enforcePartnerSafety(roleName, Array.from(new Set(expanded)));
  permissionCache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, permissions });
  return permissions;
}

export async function hasUserPermission(userId: string, permission: string) {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
}
