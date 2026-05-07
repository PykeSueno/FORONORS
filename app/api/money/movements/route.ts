import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

const MONEY_MOVEMENT_TYPES = new Set(['entry', 'exit', 'purchase', 'sale', 'payment', 'laundering']);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canEdit = await hasUserPermission(session.userId, 'money.edit');
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { type?: string; amount?: number; label?: string };
  if (!body.type || !body.amount || (body.type !== 'laundering' && !body.label)) {
    return NextResponse.json({ message: 'Type, montant et libellé requis.' }, { status: 400 });
  }

  const normalizedType = body.type.trim();
  if (!MONEY_MOVEMENT_TYPES.has(normalizedType)) return NextResponse.json({ message: 'Type de mouvement invalide.' }, { status: 400 });
  const amount = Math.abs(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });
  const sign = normalizedType === 'entry' || normalizedType === 'sale' ? 1 : -1;
  const label = normalizedType === 'laundering'
    ? (body.label?.trim() || 'Blanchiment — ajout banque')
    : String(body.label ?? '').trim();

  const supabase = getSupabaseAdmin();
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  const nextBalance = Number(cash.balance) + sign * amount;
  if (nextBalance < 0) return NextResponse.json({ message: 'Solde groupe insuffisant.' }, { status: 400 });

  const { data: movement, error: movementError } = await supabase.from('cash_movements').insert({
    type: normalizedType,
    amount: sign * amount,
    label,
    user_id: session.userId,
    before_amount: Number(cash.balance),
    after_amount: nextBalance
  }).select('id, type, amount, label, created_at, user_id, before_amount, after_amount, users(name, username)').maybeSingle();
  if (movementError || !movement) return NextResponse.json({ message: 'Création mouvement impossible.' }, { status: 400 });

  await Promise.all([
    supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id),
    Promise.resolve()
  ]);
  await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'money.movement.create',
    entityType: 'cash_movement',
    entityId: movement.id,
    summary: normalizedType === 'laundering'
      ? `Blanchiment — ajout banque: ${amount}$ retirés du groupe`
      : `Mouvement ${normalizedType} de ${amount} (${label})`,
    oldValues: { balance: Number(cash.balance) },
    newValues: { balance: nextBalance, type: normalizedType, amount: sign * amount, label, moneyBefore: Number(cash.balance), moneyAfter: nextBalance }
  });

  return NextResponse.json({ ok: true, cash: { balance: nextBalance }, movement });
}
