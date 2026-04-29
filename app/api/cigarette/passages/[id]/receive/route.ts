import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const can = await hasUserPermission(session.userId, 'cigarette.passage.create');
  if (!can) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data: passage } = await supabase.from('cigarette_passages').select('*').eq('id', Number(params.id)).maybeSingle();
  if (!passage) return NextResponse.json({ message: 'Passage introuvable.' }, { status: 404 });
  if (passage.status !== 'pending_bank') return NextResponse.json({ message: 'Statut invalide.' }, { status: 400 });
  const { data: cash } = await supabase.from('group_cash').select('id,balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });
  const before = Number(cash.balance ?? 0); const after = before + Number(passage.revenue_amount ?? 0);
  await supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cigarette_passages').update({ status: 'received_bank', before_group_cash: before, after_group_cash: after, updated_at: new Date().toISOString() }).eq('id', passage.id);
  await supabase.from('cash_movements').insert({ type: 'cigarette_bank_received', amount: Number(passage.revenue_amount ?? 0), label: `Virement Cigarette reçu (${passage.member_label})`, user_id: session.userId, before_amount: before, after_amount: after });
  await createAuditLog({ actorUserId: session.userId, action: 'cigarette.passage.receive.bank', entityType: 'cigarette_passage', entityId: passage.id, summary: `Virement reçu passage cigarette #${passage.id}`, newValues: { before, after } });
  return NextResponse.json({ ok: true, before, after });
}
