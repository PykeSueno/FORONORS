import { NextResponse } from 'next/server';
import { comparePassword, createSessionCookie } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

function logLogin(context: string, details?: unknown) {
  if (details !== undefined) {
    console.error(`[LOGIN] ${context}`, details);
    return;
  }
  console.error(`[LOGIN] ${context}`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };

    if (!body.username || !body.password) {
      return NextResponse.json({ message: 'Nom d\'utilisateur et mot de passe requis.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, role, is_active')
      .eq('username', body.username)
      .maybeSingle();

    if (error) {
      logLogin('Erreur Supabase lors de la lecture de users', {
        code: error.code,
        message: error.message,
        details: error.details
      });

      if (error.code === '42P01') {
        return NextResponse.json(
          {
            message:
              "Table 'users' introuvable. Exécutez supabase/schema.sql puis seed:first-user pour créer pyke / santa."
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: `Erreur base de données: ${error.message}` }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ message: 'Utilisateur introuvable.' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ message: 'Compte inactif.' }, { status: 403 });
    }

    const isValidPassword = await comparePassword(body.password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json({ message: 'Mot de passe invalide.' }, { status: 401 });
    }

    await createSessionCookie(user);

    return NextResponse.json({ ok: true, redirectTo: '/dashboard' });
  } catch (error) {
    logLogin('Exception inattendue sur /api/login', error);

    if (error instanceof Error) {
      return NextResponse.json({ message: `Erreur serveur: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: 'Erreur serveur inconnue.' }, { status: 500 });
  }
}
