import { NextResponse } from 'next/server';
import { comparePassword, createSessionCookie } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };

    if (!body.username || !body.password) {
      return NextResponse.json({ message: 'Identifiants requis.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, role, is_active')
      .eq('username', body.username)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ message: 'Compte inactif.' }, { status: 403 });
    }

    const isValidPassword = await comparePassword(body.password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 });
    }

    await createSessionCookie(user);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Erreur serveur.' }, { status: 500 });
  }
}
