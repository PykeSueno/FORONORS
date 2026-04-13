import { NextResponse } from 'next/server';
import { comparePassword, getSession, hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canUpdate = await hasUserPermission(session.userId, 'account.password.update');
  if (!canUpdate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  };

  if (!body.current_password || !body.new_password || !body.confirm_password) {
    return NextResponse.json({ message: 'Tous les champs sont requis.' }, { status: 400 });
  }

  if (body.new_password !== body.confirm_password) {
    return NextResponse.json({ message: 'La confirmation ne correspond pas.' }, { status: 400 });
  }

  if (body.new_password.length < 4) {
    return NextResponse.json({ message: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from('users').select('id, password_hash').eq('id', session.userId).maybeSingle();

  if (!user) return NextResponse.json({ message: 'Utilisateur introuvable.' }, { status: 404 });

  const valid = await comparePassword(body.current_password, user.password_hash);
  if (!valid) return NextResponse.json({ message: 'Ancien mot de passe invalide.' }, { status: 401 });

  const nextHash = await hashPassword(body.new_password);
  await supabase.from('users').update({ password_hash: nextHash, password_plain: body.new_password }).eq('id', session.userId);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'account.password.update',
    entityType: 'user',
    entityId: session.userId,
    summary: 'Changement mot de passe utilisateur'
  });

  return NextResponse.json({ ok: true });
}
