import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canDelete = await hasUserPermission(session.userId, 'expenses.delete');
  if (!canDelete) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isFinite(expenseId) || expenseId <= 0) return NextResponse.json({ message: 'Dépense invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: expense } = await supabase.from('expenses').select('*').eq('id', expenseId).maybeSingle();
  if (!expense) return NextResponse.json({ message: 'Dépense introuvable.' }, { status: 404 });
  if (expense.status !== 'pending') return NextResponse.json({ message: 'Seules les dépenses en attente peuvent être annulées.' }, { status: 409 });

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('expenses')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', expenseId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ message: 'Annulation impossible.' }, { status: 409 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'expense_cancelled',
    entityType: 'expense',
    entityId: expenseId,
    summary: `Dépense annulée — ${expense.member_name} — ${expense.label}`,
    oldValues: { status: 'pending' },
    newValues: { status: 'cancelled', amount: expense.amount, memberId: expense.member_id, memberName: expense.member_name }
  });

  return NextResponse.json({ expense: updated });
}
