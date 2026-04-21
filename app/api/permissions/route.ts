import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { toCanonicalPermission } from '@/lib/permission-normalization';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canManageRoles = await hasUserPermission(session.userId, 'roles.manage');
  if (!canManageRoles) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('permissions').select('id, name').order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture des permissions.' }, { status: 500 });
  }

  const canonicalByName = new Map<string, { id: number; name: string }>();
  for (const permission of (data ?? []) as Array<{ id: number; name: string }>) {
    const canonical = toCanonicalPermission(permission.name);
    const current = canonicalByName.get(canonical);
    if (!current || current.name !== canonical) canonicalByName.set(canonical, { id: permission.id, name: canonical });
  }

  return NextResponse.json({ permissions: Array.from(canonicalByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canManageRoles = await hasUserPermission(session.userId, 'roles.manage');
  if (!canManageRoles) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { name?: string; module?: string; action?: string };
  const normalizedName = body.name?.trim() || (body.module && body.action ? `${body.module.trim()}.${body.action.trim()}` : '');

  if (!normalizedName) {
    return NextResponse.json({ message: 'Nom de permission requis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const permissionName = toCanonicalPermission(normalizedName.toLowerCase());
  const { data, error } = await supabase.from('permissions').insert({ name: permissionName }).select('id, name').maybeSingle();

  if (error) {
    return NextResponse.json({ message: 'Création de permission impossible.' }, { status: 400 });
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'permissions.create',
    entityType: 'permission',
    entityId: data?.id,
    summary: `Création permission ${data?.name ?? permissionName}`,
    newValues: { name: permissionName }
  });

  return NextResponse.json({ ok: true });
}
