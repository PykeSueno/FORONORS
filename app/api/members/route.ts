import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture.' }, { status: 500 });
  }

  return NextResponse.json({ members: data });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as {
    username?: string;
    password?: string;
    role?: string;
    is_active?: boolean;
  };

  if (!body.username || !body.password) {
    return NextResponse.json({ message: 'Username et mot de passe requis.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.password);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('users').insert({
    username: body.username,
    password_hash: passwordHash,
    role: body.role ?? '',
    is_active: body.is_active ?? true
  });

  if (error) {
    return NextResponse.json({ message: 'Création impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
