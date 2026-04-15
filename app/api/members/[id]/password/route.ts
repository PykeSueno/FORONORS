import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canView, canCopyPassword, canCopyCredentials] = await Promise.all([
    hasUserPermission(session.userId, 'members.password.view'),
    hasUserPermission(session.userId, 'members.password.copy'),
    hasUserPermission(session.userId, 'members.credentials.copy')
  ]);
  const canCopy = canCopyPassword || canCopyCredentials;

  if (!canView && !canCopy) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase.from('users').select('id, password_plain').eq('id', id).maybeSingle();

  if (!member) return NextResponse.json({ message: 'Membre introuvable.' }, { status: 404 });

  return NextResponse.json({ password: member.password_plain ?? '', canView, canCopy });
}
