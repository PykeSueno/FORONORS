import { NextResponse } from 'next/server';
import { comparePassword, createSessionCookie } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

function logLogin(context: string, details?: unknown) {
  if (process.env.AUTH_DEBUG !== '1') return;
  if (details !== undefined) {
    console.info(`[LOGIN] ${context}`, details);
    return;
  }
  console.info(`[LOGIN] ${context}`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string; remember?: boolean };
    logLogin('Tentative de connexion recue', { username: body.username, remember: Boolean(body.remember) });

    if (!body.username || !body.password) {
      return NextResponse.json({ message: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, role, is_active')
      .eq('username', body.username.trim())
      .maybeSingle();

    if (error) {
      logLogin('Erreur de lecture utilisateur', { code: error.code });
      return NextResponse.json({ message: 'Connexion impossible.' }, { status: 500 });
    }

    if (!user) return NextResponse.json({ message: 'Identifiant ou mot de passe incorrect.' }, { status: 401 });
    if (!user.is_active) return NextResponse.json({ message: 'Compte inactif.' }, { status: 403 });

    const isValidPassword = await comparePassword(body.password, user.password_hash);
    if (!isValidPassword) return NextResponse.json({ message: 'Identifiant ou mot de passe incorrect.' }, { status: 401 });

    await createSessionCookie(user, Boolean(body.remember));
    logLogin('Connexion reussie', { userId: user.id, username: user.username, remember: Boolean(body.remember) });

    return NextResponse.json({ ok: true, redirectTo: '/dashboard' });
  } catch (error) {
    logLogin('Erreur serveur login', error instanceof Error ? { name: error.name } : { unknown: true });
    return NextResponse.json({ message: 'Connexion impossible.' }, { status: 500 });
  }
}
