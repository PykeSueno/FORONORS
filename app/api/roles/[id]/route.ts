import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { clearPermissionCache, hasUserPermission } from '@/lib/permissions';
import { ALL_SIMPLE_PERMISSION_NAMES, permissionsForSimpleKeys, SIMPLE_PERMISSION_BY_KEY } from '@/lib/permission-catalog';
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

async function ensureSimplePermissions(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await supabase
    .from('permissions')
    .upsert(
      ALL_SIMPLE_PERMISSION_NAMES.map((name) => ({ name: toCanonicalPermission(name) })),
      { onConflict: 'name', ignoreDuplicates: true }
    );
  if (error) throw error;
}

function validSimpleKeys(value: unknown) {
  if (!Array.isArray(value)) return null;
  return Array.from(new Set(value.map((key) => String(key)).filter((key) => Boolean(SIMPLE_PERMISSION_BY_KEY[key]))));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAuthenticatedSession();
  if ('error' in access) return access.error;

  const { id } = await params;
  const roleId = Number(id);
  const body = (await request.json()) as { permission_ids?: number[]; simple_keys?: string[]; name?: string; display_order?: number; confirm_critical?: boolean };
  const supabase = getSupabaseAdmin();
  const wantsRename = body.name !== undefined;
  const wantsManage = body.permission_ids !== undefined || body.simple_keys !== undefined || body.display_order !== undefined;

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
    .select('id, name, display_order, role_permissions(permission_id, permissions(name))')
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

  if (body.permission_ids !== undefined || body.simple_keys !== undefined) {
    try {
      await ensureSimplePermissions(supabase);
    } catch {
      return NextResponse.json({ message: 'Synchronisation des permissions impossible.' }, { status: 500 });
    }
    const requestedSimpleKeys = validSimpleKeys(body.simple_keys);
    const [{ data: selectedPermissions }, { data: allPermissions }] = await Promise.all([
      body.permission_ids !== undefined
        ? supabase.from('permissions').select('id, name').in('id', body.permission_ids)
        : Promise.resolve({ data: [] as Array<{ id: number; name: string }> }),
      supabase.from('permissions').select('id, name')
    ]);
    const canonicalByName = new Map<string, number>();
    for (const permission of (allPermissions ?? []) as Array<{ id: number; name: string }>) {
      const canonical = toCanonicalPermission(permission.name);
      if (!canonicalByName.has(canonical) || permission.name === canonical) canonicalByName.set(canonical, permission.id);
    }
    const canonicalNames = requestedSimpleKeys
      ? normalizePermissionNames(permissionsForSimpleKeys(requestedSimpleKeys))
      : normalizePermissionNames(((selectedPermissions ?? []) as Array<{ id: number; name: string }>).map((permission) => permission.name));
    const permissionIds = canonicalNames.map((name) => canonicalByName.get(name)).filter((id): id is number => Number.isInteger(id));
    const unknownPermissions = canonicalNames.filter((name) => !canonicalByName.has(name));
    if (unknownPermissions.length > 0) {
      return NextResponse.json({
        message: 'Certaines permissions sont inconnues en base.',
        unknown_permissions: unknownPermissions
      }, { status: 400 });
    }

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
    clearPermissionCache();
  }

  if (body.permission_ids !== undefined || body.simple_keys !== undefined || body.display_order !== undefined) {
    const beforePermissionNames = normalizePermissionNames(
      ((before.role_permissions ?? []) as Array<{ permissions: { name: string } | { name: string }[] | null }>)
        .map((row) => (Array.isArray(row.permissions) ? row.permissions[0]?.name : row.permissions?.name))
        .filter((name): name is string => Boolean(name))
    );
    const afterPermissionNames = body.simple_keys !== undefined
      ? normalizePermissionNames(permissionsForSimpleKeys(validSimpleKeys(body.simple_keys) ?? []))
      : body.permission_ids !== undefined
        ? normalizePermissionNames(
          ((await supabase.from('permissions').select('id, name').in('id', body.permission_ids)).data ?? [])
            .map((permission) => permission.name)
        )
      : beforePermissionNames;
    const addedPermissions = afterPermissionNames.filter((permission) => !beforePermissionNames.includes(permission));
    const removedPermissions = beforePermissionNames.filter((permission) => !afterPermissionNames.includes(permission));

    await createAuditLog({
      actorUserId: access.session.userId,
      action: 'roles.edit',
      entityType: 'role',
      entityId: roleId,
      summary: `Modification du rôle ${newRoleName ?? before.name ?? roleId}`,
      oldValues: {
        roleId,
        roleName: before.name,
        displayOrder: before.display_order,
        permissions: beforePermissionNames
      },
      newValues: {
        roleId,
        roleName: newRoleName ?? before.name,
        displayOrder: body.display_order ?? before.display_order,
        permissionIds: body.permission_ids,
        simpleKeys: validSimpleKeys(body.simple_keys),
        permissions: afterPermissionNames,
        addedPermissions,
        removedPermissions,
        adminUserId: access.session.userId,
        modifiedAt: new Date().toISOString()
      }
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
