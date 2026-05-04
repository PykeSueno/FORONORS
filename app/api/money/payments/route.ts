import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canHistory] = await Promise.all([
    hasUserPermission(session.userId, 'money.pay.access'),
    hasUserPermission(session.userId, 'money.pay.history.view')
  ]);
  if (!canAccess || !canHistory) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from('transactions')
    .select('id, actor_user_id, member_user_id, member_label, reason, total_money_out, created_at')
    .ilike('reason', 'Paye:%')
    .order('created_at', { ascending: false })
    .limit(120);

  return NextResponse.json({ payments: rows ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'money.pay.access'),
    hasUserPermission(session.userId, 'money.pay.create')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { member_user_id?: string; amount?: number; reason?: string };
  const memberId = body.member_user_id?.trim();
  const reason = body.reason?.trim();
  const amount = Math.max(0, Number(body.amount ?? 0));

  if (!memberId || !reason || amount <= 0) {
    return NextResponse.json({ message: 'Membre, montant et raison sont requis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'money.pay', action: 'create', memberIds: [memberId] });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
  const [{ data: member }, { data: cash }] = await Promise.all([
    supabase.from('users').select('id, name, username').eq('is_active', true).eq('id', memberId).maybeSingle(),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle()
  ]);

  if (!member) return NextResponse.json({ message: 'Membre introuvable.' }, { status: 404 });
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  const balanceBefore = Number(cash.balance ?? 0);
  const balanceAfter = balanceBefore - amount;
  if (balanceAfter < 0) return NextResponse.json({ message: 'Solde groupe insuffisant pour cette paye.' }, { status: 400 });

  const memberLabel = member.name || member.username || 'Membre';
  const txReason = `Paye: ${reason}`;

  await supabase.from('group_cash').update({ balance: balanceAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: 'payment',
    amount: -amount,
    label: `Paye ${memberLabel} · ${reason}`,
    user_id: session.userId
  });

  const { data: transaction } = await supabase
    .from('transactions')
    .insert({
      actor_user_id: session.userId,
      member_user_id: memberId,
      member_label: memberLabel,
      reason: txReason,
      total_money_in: 0,
      total_money_out: amount,
      stock_in_count: 0,
      stock_out_count: 0,
      profit_loss: -amount,
      summary: `Paye membre ${memberLabel} · ${amount}$`
    })
    .select('id')
    .maybeSingle();

  await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'money.pay.create',
    entityType: 'payment',
    entityId: transaction?.id ?? null,
    summary: `Paye vers ${memberLabel} (${amount}$)`,
    oldValues: { balance: balanceBefore },
    newValues: {
      member_user_id: memberId,
      member_label: memberLabel,
      amount,
      reason,
      balance: balanceAfter
    }
  });

  return NextResponse.json({ ok: true, payment: transaction });
}
