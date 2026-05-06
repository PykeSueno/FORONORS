import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

async function canAny(userId: string, permissions: string[]) {
  const results = await Promise.all(permissions.map((permission) => hasUserPermission(userId, permission)));
  return results.some(Boolean);
}

const CATEGORIES = ['Garage', 'Essence', 'Amende', 'Achat', 'Opération', 'Nourriture', 'Soins', 'Autres'];

type PatchBody = {
  member_id?: string;
  amount?: number;
  category?: string;
  note?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canEdit = await canAny(session.userId, ['member_ops.expenses.edit', 'expenses.edit']);
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isFinite(expenseId) || expenseId <= 0) return NextResponse.json({ message: 'Dépense invalide.' }, { status: 400 });

  const body = await request.json() as PatchBody;
  const memberId = String(body.member_id ?? '');
  const amount = Math.round(Number(body.amount ?? 0) * 100) / 100;
  const category = CATEGORIES.includes(String(body.category ?? '')) ? String(body.category) : 'Autres';
  const note = String(body.note ?? '').trim() || null;
  const label = note || category;

  if (!memberId) return NextResponse.json({ message: 'Membre requis.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [{ data: expense }, { data: member }] = await Promise.all([
    supabase.from('expenses').select('*').eq('id', expenseId).maybeSingle(),
    supabase.from('users').select('id, name, username, is_active').eq('id', memberId).maybeSingle()
  ]);

  if (!expense) return NextResponse.json({ message: 'Dépense introuvable.' }, { status: 404 });
  if (expense.status !== 'pending') return NextResponse.json({ message: 'Seules les dépenses en attente peuvent être modifiées.' }, { status: 409 });
  if (!member || !member.is_active) return NextResponse.json({ message: 'Membre inactif ou introuvable.' }, { status: 400 });

  const memberName = member.name || member.username || 'Membre';
  const oldValues = {
    member_id: expense.member_id,
    member_name: expense.member_name,
    amount: expense.amount,
    category: expense.category,
    note: expense.note,
    label: expense.label
  };

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({
      member_id: member.id,
      member_name: memberName,
      label,
      amount,
      category,
      note,
      updated_at: new Date().toISOString()
    })
    .eq('id', expenseId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ message: 'Modification dépense impossible.' }, { status: 409 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'expense_updated',
    entityType: 'expense',
    entityId: expenseId,
    summary: `Dépense modifiée — ${memberName} — ${category} — ${amount}$`,
    oldValues,
    newValues: {
      member_id: member.id,
      member_name: memberName,
      amount,
      category,
      note,
      label
    }
  });

  return NextResponse.json({ expense: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canDelete = await canAny(session.userId, ['member_ops.expenses.cancel', 'expenses.delete']);
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
