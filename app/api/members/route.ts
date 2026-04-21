import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type MemberRow = {
  id: string;
  username: string;
  name: string;
  role: string | null;
  role_id: number | null;
  is_active: boolean;
  roles: Array<{ name: string }> | { name: string } | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'members.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, role, role_id, is_active, roles(name)')
    .order('username', { ascending: true });

  if (error) return NextResponse.json({ message: 'Erreur de lecture.' }, { status: 500 });

  const members = ((data ?? []) as MemberRow[]).map((member) => ({
    id: member.id,
    name: member.name,
    username: member.username,
    role_id: member.role_id,
    role_name: (Array.isArray(member.roles) ? member.roles[0]?.name : member.roles?.name) ?? member.role ?? '',
    is_active: member.is_active
  }));

  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canCreate, canEditPassword] = await Promise.all([
    hasUserPermission(session.userId, 'members.create'),
    hasUserPermission(session.userId, 'members.password.edit')
  ]);
  if (!canCreate || !canEditPassword) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    username?: string;
    name?: string;
    password?: string;
    role_id?: number | null;
    is_active?: boolean;
  };

  if (!body.username || !body.password || !body.name) {
    return NextResponse.json({ message: 'Nom, user et mot de passe requis.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.password);
  const supabase = getSupabaseAdmin();

  let roleName = '';
  if (body.role_id) {
    const { data: role } = await supabase.from('roles').select('name').eq('id', body.role_id).maybeSingle();
    roleName = role?.name ?? '';
  }

  const payload = {
    username: body.username.trim(),
    name: body.name.trim(),
    password_hash: passwordHash,
    password_plain: body.password,
    role_id: body.role_id ?? null,
    role: roleName,
    is_active: body.is_active ?? true
  };

  const { data: createdUser, error } = await supabase.from('users').insert(payload).select('id, username, name').maybeSingle();

  if (error) return NextResponse.json({ message: 'Création impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'members.create',
    entityType: 'member',
    entityId: createdUser?.id,
    summary: `Création du membre ${createdUser?.name ?? payload.name} (@${createdUser?.username ?? payload.username})`,
    newValues: { ...payload, password_hash: '[hidden]' }
  });

  return NextResponse.json({ ok: true });
}
