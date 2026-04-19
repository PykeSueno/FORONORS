import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, display_order, role_permissions(permission_id, permissions(id, name))')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture des rôles.' }, { status: 500 });
  }

  const roles = ((data ?? []) as RoleRow[]).map((role) => ({
    id: role.id,
    name: role.name,
    display_order: role.display_order,
    permission_ids: role.role_permissions.map((rp) => rp.permission_id),
    permissions: role.role_permissions
      .map((rp) => (Array.isArray(rp.permissions) ? rp.permissions[0] : rp.permissions))
      .filter((permission): permission is PermissionRow => Boolean(permission))
  }));

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
  const permissionIds = Array.from(new Set((body.permission_ids ?? []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
  if (roleIds.length === 0) return NextResponse.json({ message: 'Sélectionnez au moins un rôle.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: roles } = await supabase.from('roles').select('id, name').in('id', roleIds);
  if (!roles || roles.length === 0) return NextResponse.json({ message: 'Rôles introuvables.' }, { status: 404 });

  for (const role of roles) {
    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', role.id);
    if (deleteError) return NextResponse.json({ message: 'Mise à jour des rôles impossible.' }, { status: 400 });

    if (permissionIds.length > 0) {
      const { error: insertError } = await supabase.from('role_permissions').insert(
        permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId }))
      );
      if (insertError) return NextResponse.json({ message: 'Attribution des permissions impossible.' }, { status: 400 });
    }
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'roles.permissions.bulk.edit',
    entityType: 'role',
    entityId: null,
    summary: `Mise à jour groupée des permissions sur ${roles.length} rôles`,
    newValues: {
      roleIds: roles.map((role) => role.id),
      roleNames: roles.map((role) => role.name),
      permissionIds
    }
  });

  return NextResponse.json({ ok: true, updated_role_ids: roles.map((role) => role.id) });
}
