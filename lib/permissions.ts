import { getSupabaseAdmin } from './supabase';

type PermissionRelation = { permissions: { name: string } | { name: string }[] | null };

export async function getUserPermissions(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from('users').select('role_id').eq('id', userId).maybeSingle();

  if (!user?.role_id) return [] as string[];

  const { data } = await supabase
    .from('role_permissions')
    .select('permissions(name)')
    .eq('role_id', user.role_id);

  const permissions = ((data ?? []) as PermissionRelation[])
    .map((item) => (Array.isArray(item.permissions) ? item.permissions[0]?.name : item.permissions?.name))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(permissions));
}

export async function hasUserPermission(userId: string, permission: string) {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
}
