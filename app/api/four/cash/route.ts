import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAddCash = await hasUserPermission(session.userId, 'four.cash.add');
  if (!canAddCash) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { session_id?: number; amount?: number };
  const sessionId = Number(body.session_id);
  const amount = Math.max(0, Number(body.amount ?? 0));
  if (!sessionId || amount <= 0) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: fourSession } = await supabase.from('four_sessions').select('id, status, summary').eq('id', sessionId).maybeSingle();
  if (!fourSession || fourSession.status !== 'open') return NextResponse.json({ message: 'Session FOUR non active.' }, { status: 400 });

  const summary = (fourSession.summary ?? {}) as Record<string, unknown>;
  const before = Number(summary.cash_added_total ?? 0);
  const after = before + amount;

  await supabase.from('four_sessions').update({ summary: { ...summary, cash_added_total: after } }).eq('id', sessionId);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'four.cash.add',
    entityType: 'four_session',
    entityId: sessionId,
    summary: `Ajout cash FOUR +${amount}`,
    newValues: { before, added: amount, after }
  });

  return NextResponse.json({ ok: true, cash_added_total: after });
}
