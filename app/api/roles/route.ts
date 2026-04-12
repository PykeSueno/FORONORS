import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
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
  const { error } = await supabase.from('roles').insert({
    name: body.name.trim(),
    display_order: body.display_order ?? 100
  });

  if (error) {
    return NextResponse.json({ message: 'Création du rôle impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
