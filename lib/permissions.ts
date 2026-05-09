import { getSupabaseAdmin } from './supabase';
import { expandPermissionAliases, normalizePermissionNames } from './permission-normalization';
import { PERMISSION_LABELS } from './permission-catalog';

type PermissionRelation = { permissions: { name: string } | { name: string }[] | null };

export async function getUserPermissions(userId: string) {
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
    return Array.from(new Set(canonical.flatMap((permission) => expandPermissionAliases(permission))));
  }

  if (!user?.role_id) return [] as string[];

  const { data } = await supabase.from('role_permissions').select('permissions(name)').eq('role_id', user.role_id);

  const rawPermissions = ((data ?? []) as PermissionRelation[])
    .map((item) => (Array.isArray(item.permissions) ? item.permissions[0]?.name : item.permissions?.name))
    .filter((value): value is string => Boolean(value));

  const canonical = normalizePermissionNames(rawPermissions);
  const expanded = canonical.flatMap((permission) => expandPermissionAliases(permission));
  return Array.from(new Set(expanded));
}

export async function hasUserPermission(userId: string, permission: string) {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
}
