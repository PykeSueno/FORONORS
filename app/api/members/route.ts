import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type MemberRow = {
  id: string;
  username: string;
  role: string | null;
  role_id: number | null;
  is_active: boolean;
  created_at: string;
  roles: { name: string } | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, role_id, is_active, created_at, roles(name)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture.' }, { status: 500 });
  }

  const members = ((data ?? []) as MemberRow[]).map((member) => ({
    id: member.id,
    username: member.username,
    role_id: member.role_id,
    role_name: member.roles?.name ?? member.role ?? '',
    is_active: member.is_active,
    created_at: member.created_at
  }));

  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as {
    username?: string;
    password?: string;
    role_id?: number | null;
    is_active?: boolean;
  };

  if (!body.username || !body.password) {
    return NextResponse.json({ message: 'Username et mot de passe requis.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.password);
  const supabase = getSupabaseAdmin();

  let roleName = '';
  if (body.role_id) {
    const { data: role } = await supabase.from('roles').select('name').eq('id', body.role_id).maybeSingle();
    roleName = role?.name ?? '';
  }

  const { error } = await supabase.from('users').insert({
    username: body.username,
    password_hash: passwordHash,
    role_id: body.role_id ?? null,
    role: roleName,
    is_active: body.is_active ?? true
  });

  if (error) {
    return NextResponse.json({ message: 'Création impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
