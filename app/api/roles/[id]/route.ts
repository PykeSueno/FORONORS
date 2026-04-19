import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizePermissionNames, toCanonicalPermission } from '@/lib/permission-normalization';

async function ensureRolesManagePermission() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: 'Non autorisé.' }, { status: 401 }) };

  const canManageRoles = await hasUserPermission(session.userId, 'roles.manage');
  if (!canManageRoles) return { error: NextResponse.json({ message: 'Accès refusé.' }, { status: 403 }) };

  return { session };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await ensureRolesManagePermission();
  if ('error' in access) return access.error;

  const { id } = await params;
  const roleId = Number(id);
  const body = (await request.json()) as { permission_ids?: number[]; name?: string; display_order?: number };
  const supabase = getSupabaseAdmin();

  const { data: before } = await supabase
    .from('roles')
    .select('id, name, display_order, role_permissions(permission_id)')
    .eq('id', roleId)
    .maybeSingle();

  if (body.name !== undefined || body.display_order !== undefined) {
    const { error: updateRoleError } = await supabase
      .from('roles')
      .update({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.display_order !== undefined ? { display_order: body.display_order } : {})
      })
      .eq('id', roleId);

    if (updateRoleError) {
      return NextResponse.json({ message: 'Mise à jour du rôle impossible.' }, { status: 400 });
    }
  }

  if (body.permission_ids !== undefined) {
    const [{ data: selectedPermissions }, { data: allPermissions }] = await Promise.all([
      supabase.from('permissions').select('id, name').in('id', body.permission_ids),
      supabase.from('permissions').select('id, name')
    ]);
    const canonicalByName = new Map<string, number>();
    for (const permission of (allPermissions ?? []) as Array<{ id: number; name: string }>) {
      const canonical = toCanonicalPermission(permission.name);
      if (!canonicalByName.has(canonical) || permission.name === canonical) canonicalByName.set(canonical, permission.id);
    }
    const canonicalNames = normalizePermissionNames(((selectedPermissions ?? []) as Array<{ id: number; name: string }>).map((permission) => permission.name));
    const permissionIds = canonicalNames.map((name) => canonicalByName.get(name)).filter((id): id is number => Number.isInteger(id));

    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', roleId);
    if (deleteError) return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });

    if (permissionIds.length > 0) {
      const { error: insertError } = await supabase.from('role_permissions').insert(
        permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId }))
      );

      if (insertError) {
        return NextResponse.json({ message: 'Attribution des permissions impossible.' }, { status: 400 });
      }
    }
  }

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'roles.edit',
    entityType: 'role',
    entityId: roleId,
    summary: `Modification du rôle ${body.name ?? (before as { name?: string } | null)?.name ?? roleId}`,
    oldValues: before as Record<string, unknown> | null,
    newValues: body as Record<string, unknown>
  });

  const { data: updated } = await supabase
    .from('roles')
    .select('id, name, display_order, role_permissions(permission_id)')
    .eq('id', roleId)
    .maybeSingle();

  return NextResponse.json({ ok: true, role: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await ensureRolesManagePermission();
  if ('error' in access) return access.error;

  const { id } = await params;
  const roleId = Number(id);
  const supabase = getSupabaseAdmin();

  const { data: before } = await supabase.from('roles').select('id, name, display_order').eq('id', roleId).maybeSingle();

  await supabase.from('users').update({ role_id: null, role: '' }).eq('role_id', roleId);
  const { error } = await supabase.from('roles').delete().eq('id', roleId);

  if (error) {
    return NextResponse.json({ message: 'Suppression du rôle impossible.' }, { status: 400 });
  }

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'roles.delete',
    entityType: 'role',
    entityId: roleId,
    summary: `Suppression du rôle ${before?.name ?? roleId}`,
    oldValues: before as Record<string, unknown> | null
  });

  const { data: updated } = await supabase
    .from('roles')
    .select('id, name, display_order, role_permissions(permission_id)')
    .eq('id', roleId)
    .maybeSingle();

  return NextResponse.json({ ok: true, role: updated });
}
