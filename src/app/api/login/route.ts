import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as { username?: string; password?: string };

  if (!username || !password) {
    return NextResponse.json({ message: 'Nom d\'utilisateur et mot de passe requis.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('users')
    .select('id, username, password_hash, role, is_active')
    .eq('username', username)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 });
  }

  if (!data.is_active) {
    return NextResponse.json({ message: 'Compte désactivé.' }, { status: 403 });
  }

  const isPasswordValid = await bcrypt.compare(password, data.password_hash);
  if (!isPasswordValid) {
    return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 });
  }

  await createSessionCookie({
    userId: data.id,
    username: data.username,
    role: data.role,
  });

  return NextResponse.json({ ok: true });
}
