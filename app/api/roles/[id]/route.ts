import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizePermissionNames, toCanonicalPermission } from '@/lib/permission-normalization';

async function getAuthenticatedSession() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: 'Non autorisé.' }, { status: 401 }) };
  return { session };
}

function isCriticalRoleName(name?: string | null) {
  const normalized = (name ?? '').trim().toLowerCase();
  return ['patron', 'lead', 'admin', 'administrateur'].includes(normalized);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAuthenticatedSession();
  if ('error' in access) return access.error;

  const { id } = await params;
  const roleId = Number(id);
  const body = (await request.json()) as { permission_ids?: number[]; name?: string; display_order?: number; confirm_critical?: boolean };
  const supabase = getSupabaseAdmin();
  const wantsRename = body.name !== undefined;
  const wantsManage = body.permission_ids !== undefined || body.display_order !== undefined;

  if (wantsRename) {
    const canRenameRole = await hasUserPermission(access.session.userId, 'roles.rename');
    if (!canRenameRole) return NextResponse.json({ message: 'Permission renommage rôle manquante.' }, { status: 403 });
  }

  if (wantsManage) {
    const canManageRoles = await hasUserPermission(access.session.userId, 'roles.manage');
    if (!canManageRoles) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const { data: before } = await supabase
    .from('roles')
    .select('id, name, display_order, role_permissions(permission_id)')
    .eq('id', roleId)
    .maybeSingle();
  if (!before) return NextResponse.json({ message: 'Rôle introuvable.' }, { status: 404 });

  const newRoleName = body.name?.trim();
  if (wantsRename) {
    if (!newRoleName) return NextResponse.json({ message: 'Nom du rôle requis.' }, { status: 400 });
    if (isCriticalRoleName(before.name) || isCriticalRoleName(newRoleName)) {
      if (!body.confirm_critical) return NextResponse.json({ message: 'Confirmation requise pour renommer un rôle critique.' }, { status: 400 });
    }
    const { data: duplicate } = await supabase
      .from('roles')
      .select('id')
      .ilike('name', newRoleName)
      .neq('id', roleId)
      .maybeSingle();
    if (duplicate) return NextResponse.json({ message: 'Un rôle porte déjà ce nom.' }, { status: 400 });
  }

  if (wantsRename || body.display_order !== undefined) {
    const { error: updateRoleError } = await supabase
      .from('roles')
      .update({
        ...(newRoleName !== undefined ? { name: newRoleName } : {}),
        ...(body.display_order !== undefined ? { display_order: body.display_order } : {})
      })
      .eq('id', roleId);

    if (updateRoleError) {
      return NextResponse.json({ message: 'Mise à jour du rôle impossible.' }, { status: 400 });
    }

    if (newRoleName !== undefined && newRoleName !== before.name) {
      const { error: updateUsersRoleError } = await supabase.from('users').update({ role: newRoleName }).eq('role_id', roleId);
      if (updateUsersRoleError) return NextResponse.json({ message: 'Rôle renommé, mais synchronisation membres impossible.' }, { status: 400 });
      await createAuditLog({
        actorUserId: access.session.userId,
        action: 'roles.rename',
        entityType: 'role',
        entityId: roleId,
        summary: `Renommage du rôle ${before.name} en ${newRoleName}`,
        oldValues: { name: before.name },
        newValues: { name: newRoleName },
        metadata: {
          oldName: before.name,
          newName: newRoleName,
          adminUserId: access.session.userId,
          renamedAt: new Date().toISOString(),
          critical: isCriticalRoleName(before.name) || isCriticalRoleName(newRoleName)
        }
      });
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

  if (body.permission_ids !== undefined || body.display_order !== undefined) {
    await createAuditLog({
      actorUserId: access.session.userId,
      action: 'roles.edit',
      entityType: 'role',
      entityId: roleId,
      summary: `Modification du rôle ${newRoleName ?? before.name ?? roleId}`,
      oldValues: before as Record<string, unknown> | null,
      newValues: body as Record<string, unknown>
    });
  }

  const { data: updated } = await supabase
    .from('roles')
    .select('id, name, display_order, role_permissions(permission_id)')
    .eq('id', roleId)
    .maybeSingle();

  return NextResponse.json({ ok: true, role: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAuthenticatedSession();
  if ('error' in access) return access.error;
  const canManageRoles = await hasUserPermission(access.session.userId, 'roles.manage');
  if (!canManageRoles) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

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
