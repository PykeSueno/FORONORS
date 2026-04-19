import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizePermissionNames, toCanonicalPermission } from '@/lib/permission-normalization';

type PermissionRow = { id: number; name: string };
type RolePermissionRow = { permission_id: number; permissions: PermissionRow | PermissionRow[] | null };
type RoleRow = { id: number; name: string; display_order: number; role_permissions: RolePermissionRow[] };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canManageRoles = await hasUserPermission(session.userId, 'roles.manage');
  const canAccessMembers = await hasUserPermission(session.userId, 'members.access');
  if (!canManageRoles && !canAccessMembers) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const [{ data, error }, { data: allPermissions }] = await Promise.all([
    supabase
      .from('roles')
      .select('id, name, display_order, role_permissions(permission_id, permissions(id, name))')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('permissions').select('id, name')
  ]);

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture des rôles.' }, { status: 500 });
  }

  const canonicalPermissionIdByName = new Map<string, number>();
  for (const permission of (allPermissions ?? []) as PermissionRow[]) {
    const canonical = toCanonicalPermission(permission.name);
    if (!canonicalPermissionIdByName.has(canonical) || permission.name === canonical) canonicalPermissionIdByName.set(canonical, permission.id);
  }

  const roles = ((data ?? []) as RoleRow[]).map((role) => {
    const rawNames = role.role_permissions
      .map((rp) => (Array.isArray(rp.permissions) ? rp.permissions[0] : rp.permissions))
      .filter((permission): permission is PermissionRow => Boolean(permission))
      .map((permission) => permission.name);
    const canonicalNames = normalizePermissionNames(rawNames);
    return {
    id: role.id,
    name: role.name,
    display_order: role.display_order,
    permission_ids: canonicalNames.map((name) => canonicalPermissionIdByName.get(name)).filter((id): id is number => Number.isInteger(id)),
    permissions: canonicalNames.map((name) => {
      const id = canonicalPermissionIdByName.get(name);
      return { id: Number(id ?? 0), name };
    }).filter((permission) => permission.id > 0)
  };
  });

  return NextResponse.json({ roles });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canManageRoles = await hasUserPermission(session.userId, 'roles.manage');
  if (!canManageRoles) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { name?: string; display_order?: number };

  if (!body.name) {
    return NextResponse.json({ message: 'Nom du rôle requis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const payload = {
    name: body.name.trim(),
    display_order: body.display_order ?? 100
  };
  const { data, error } = await supabase.from('roles').insert(payload).select('id, name').maybeSingle();

  if (error) {
    return NextResponse.json({ message: 'Création du rôle impossible.' }, { status: 400 });
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'roles.create',
    entityType: 'role',
    entityId: data?.id,
    summary: `Création du rôle ${data?.name ?? payload.name}`,
    newValues: payload
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canManageRoles = await hasUserPermission(session.userId, 'roles.manage');
  if (!canManageRoles) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { role_ids?: number[]; permission_ids?: number[] };
  const roleIds = Array.from(new Set((body.role_ids ?? []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
  if (roleIds.length === 0) return NextResponse.json({ message: 'Sélectionnez au moins un rôle.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [{ data: roles }, { data: selectedPermissions }, { data: allPermissions }, { data: previousRolePermissions }] = await Promise.all([
    supabase.from('roles').select('id, name').in('id', roleIds),
    supabase.from('permissions').select('id, name').in('id', body.permission_ids ?? []),
    supabase.from('permissions').select('id, name'),
    supabase.from('role_permissions').select('role_id, permissions(name)').in('role_id', roleIds)
  ]);
  if (!roles || roles.length === 0) return NextResponse.json({ message: 'Rôles introuvables.' }, { status: 404 });

  const canonicalByName = new Map<string, number>();
  for (const permission of (allPermissions ?? []) as PermissionRow[]) {
    const canonical = toCanonicalPermission(permission.name);
    if (!canonicalByName.has(canonical) || permission.name === canonical) canonicalByName.set(canonical, permission.id);
  }
  const selectedCanonical = normalizePermissionNames(((selectedPermissions ?? []) as PermissionRow[]).map((permission) => permission.name));
  const permissionIds = selectedCanonical.map((name) => canonicalByName.get(name)).filter((id): id is number => Number.isInteger(id));
  const previousByRole = new Map<number, string[]>();
  for (const row of (previousRolePermissions ?? []) as Array<{ role_id: number; permissions: { name: string } | { name: string }[] | null }>) {
    const permissionName = Array.isArray(row.permissions) ? row.permissions[0]?.name : row.permissions?.name;
    if (!permissionName) continue;
    const current = previousByRole.get(row.role_id) ?? [];
    current.push(permissionName);
    previousByRole.set(row.role_id, current);
  }
  const { error: rpcError } = await supabase.rpc('set_roles_permissions_bulk', { p_role_ids: roleIds, p_permission_ids: permissionIds });

  if (rpcError) return NextResponse.json({ message: 'Mise à jour des rôles impossible.' }, { status: 400 });

  const roleChanges = (roles ?? []).map((role) => {
    const before = normalizePermissionNames(previousByRole.get(role.id) ?? []);
    const added = selectedCanonical.filter((permission) => !before.includes(permission));
    const removed = before.filter((permission) => !selectedCanonical.includes(permission));
    return { roleId: role.id, roleName: role.name, before, after: selectedCanonical, added, removed };
  });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'roles.permissions.bulk.edit',
    entityType: 'role',
    entityId: null,
    summary: `Mise à jour groupée des permissions sur ${roles.length} rôles`,
    newValues: {
      roleIds: roles.map((role) => role.id),
      roleNames: roles.map((role) => role.name),
      permissionIds,
      permissionNames: selectedCanonical,
      roleChanges
    }
  });

  return NextResponse.json({ ok: true, updated_role_ids: roles.map((role) => role.id) });
}
