import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase-server';

const allowedRoles = ['super_admin', 'admin', 'member'] as const;

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from('users')
    .select('id, username, role, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: 'Impossible de charger les membres.' }, { status: 500 });
  }

  return NextResponse.json({ members: data });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookie();
  if (!session || (session.role !== 'super_admin' && session.role !== 'admin')) {
    return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const { username, password, role, isActive } = (await request.json()) as {
    username?: string;
    password?: string;
    role?: string;
    isActive?: boolean;
  };

  if (!username || !password || !role || !allowedRoles.includes(role as (typeof allowedRoles)[number])) {
    return NextResponse.json({ message: 'Données invalides.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseServer
    .from('users')
    .insert({
      username,
      password_hash: passwordHash,
      role,
      is_active: Boolean(isActive),
    })
    .select('id, username, role, is_active, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Nom d\'utilisateur déjà utilisé.' }, { status: 409 });
    }

    return NextResponse.json({ message: 'Impossible de créer le membre.' }, { status: 500 });
  }

  return NextResponse.json({ member: data }, { status: 201 });
}
