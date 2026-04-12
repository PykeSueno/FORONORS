import { NextResponse } from 'next/server';
import { comparePassword, createSessionCookie, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

function logLogin(context: string, details?: unknown) {
  if (details !== undefined) {
    console.info(`[LOGIN] ${context}`, details);
    return;
  }
  console.info(`[LOGIN] ${context}`);
}

async function ensureInitialPykeUser() {
  const supabase = getSupabaseAdmin();
  const { data: existingPyke, error: existingPykeError } = await supabase
    .from('users')
    .select('id')
    .eq('username', 'pyke')
    .maybeSingle();

  if (existingPykeError) {
    throw new Error(`Lecture utilisateur pyke impossible: ${existingPykeError.message}`);
  }

  if (existingPyke) {
    return;
  }

  const passwordHash = await hashPassword('santa');

  const { error: insertError } = await supabase.from('users').insert({
    username: 'pyke',
    password_hash: passwordHash,
    role: 'Patron',
    is_active: true
  });

  if (insertError) {
    throw new Error(`Création utilisateur pyke impossible: ${insertError.message}`);
  }

  logLogin('Utilisateur initial pyke créé automatiquement.');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };

    if (!body.username || !body.password) {
      return NextResponse.json({ message: 'Nom d\'utilisateur et mot de passe requis.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { count, error: countError } = await supabase.from('users').select('id', { count: 'exact', head: true });

    if (countError) {
      logLogin('Erreur count users', {
        code: countError.code,
        message: countError.message,
        details: countError.details
      });
    } else {
      logLogin('Lecture table users OK', { usersCount: count ?? 0 });
    }

    const { data: pykeProbe, error: pykeProbeError } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'pyke')
      .maybeSingle();

    if (pykeProbeError) {
      logLogin('Erreur sonde pyke', { code: pykeProbeError.code, message: pykeProbeError.message });
    } else {
      logLogin('Sonde pyke', { pykeExists: Boolean(pykeProbe) });
    }

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

    if (!user && body.username === 'pyke') {
      await ensureInitialPykeUser();
      const { data: createdUser, error: createdUserError } = await supabase
        .from('users')
        .select('id, username, password_hash, role, is_active')
        .eq('username', 'pyke')
        .maybeSingle();

      if (createdUserError || !createdUser) {
        logLogin('Echec relecture pyke après création', createdUserError);
        return NextResponse.json({ message: 'Impossible de préparer le compte initial pyke.' }, { status: 500 });
      }

      const isValidBootstrapPassword = await comparePassword(body.password, createdUser.password_hash);

      if (!isValidBootstrapPassword) {
        return NextResponse.json({ message: 'Mot de passe invalide.' }, { status: 401 });
      }

      await createSessionCookie(createdUser);
      return NextResponse.json({ ok: true, redirectTo: '/dashboard' });
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
