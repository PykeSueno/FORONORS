import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

async function canAny(userId: string, permissions: string[]) {
  const results = await Promise.all(permissions.map((permission) => hasUserPermission(userId, permission)));
  return results.some(Boolean);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canReimburse = await canAny(session.userId, ['member_ops.expenses.reimburse', 'expenses.reimburse']);
  if (!canReimburse) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isFinite(expenseId) || expenseId <= 0) return NextResponse.json({ message: 'Dépense invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: expense } = await supabase.from('expenses').select('*').eq('id', expenseId).maybeSingle();
  if (!expense) return NextResponse.json({ message: 'Dépense introuvable.' }, { status: 404 });
  if (expense.status !== 'pending') return NextResponse.json({ message: 'Cette dépense est déjà traitée.' }, { status: 409 });

  const amount = Number(expense.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const before = Number(cash.balance ?? 0);
  if (before < amount) return NextResponse.json({ message: 'Argent groupe insuffisant pour rembourser.' }, { status: 400 });
  const after = Math.round((before - amount) * 100) / 100;
  const now = new Date().toISOString();
  const label = `Remboursement dépense — ${expense.member_name} — ${expense.label}`;

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({
      status: 'reimbursed',
      reimbursed_by: session.userId,
      reimbursed_at: now,
      money_before: before,
      money_after: after,
      updated_at: now
    })
    .eq('id', expenseId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ message: 'Remboursement déjà traité ou impossible.' }, { status: 409 });

  await Promise.all([
    supabase.from('group_cash').update({ balance: after, updated_at: now }).eq('id', cash.id),
    supabase.from('cash_movements').insert({
      type: 'exit',
      amount: -amount,
      label,
      user_id: session.userId,
      before_amount: before,
      after_amount: after
    })
  ]);
  await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'expense_reimbursed',
    entityType: 'expense',
    entityId: expenseId,
    summary: `Dépense remboursée pour ${expense.member_name} — ${expense.label} — ${amount}$`,
    oldValues: { status: 'pending', groupCash: before },
    newValues: { status: 'reimbursed', groupCash: after, amount, memberId: expense.member_id, memberName: expense.member_name }
  });

  return NextResponse.json({ expense: updated, cashAfter: after });
}
