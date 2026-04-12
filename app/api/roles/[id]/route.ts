import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  const body = (await request.json()) as { permission_ids?: number[]; name?: string; display_order?: number };
  const supabase = getSupabaseAdmin();

  if (body.name !== undefined || body.display_order !== undefined) {
    const { error: updateRoleError } = await supabase
      .from('roles')
      .update({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.display_order !== undefined ? { display_order: body.display_order } : {})
      })
      .eq('id', Number(id));

    if (updateRoleError) {
      return NextResponse.json({ message: 'Mise à jour du rôle impossible.' }, { status: 400 });
    }
  }

  if (body.permission_ids) {
    const permissionIds = Array.from(new Set(body.permission_ids));

    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', Number(id));
    if (deleteError) return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });

    if (permissionIds.length > 0) {
      const { error: insertError } = await supabase.from('role_permissions').insert(
        permissionIds.map((permissionId) => ({ role_id: Number(id), permission_id: permissionId }))
      );

      if (insertError) {
        return NextResponse.json({ message: 'Attribution des permissions impossible.' }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await ensureRolesManagePermission();
  if ('error' in access) return access.error;

  const { id } = await params;
  const roleId = Number(id);
  const supabase = getSupabaseAdmin();

  await supabase.from('users').update({ role_id: null, role: '' }).eq('role_id', roleId);
  const { error } = await supabase.from('roles').delete().eq('id', roleId);

  if (error) {
    return NextResponse.json({ message: 'Suppression du rôle impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
