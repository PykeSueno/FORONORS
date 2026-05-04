import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';

type TxLineInput = {
  item_id: number;
  movement_type: 'purchase' | 'sale' | 'stock_in' | 'stock_out';
  quantity: number;
  unit_price: number;
};

function computeEffects(line: TxLineInput, isMoneyItem: boolean) {
  if (isMoneyItem) {
    const total = Number(line.quantity);
    const money = line.movement_type === 'purchase' || line.movement_type === 'stock_out' ? -total : total;
    return { stockEffect: 0, moneyEffect: money, total };
  }

  const total = Number(line.quantity) * Number(line.unit_price);

  if (line.movement_type === 'purchase') return { stockEffect: Number(line.quantity), moneyEffect: -total, total };
  if (line.movement_type === 'sale') return { stockEffect: -Number(line.quantity), moneyEffect: total, total };
  if (line.movement_type === 'stock_in') return { stockEffect: Number(line.quantity), moneyEffect: 0, total };
  return { stockEffect: -Number(line.quantity), moneyEffect: 0, total };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate, canEditOwn, canEditAny, canCancelOwn, canCancelAny, canManageOwn, canManageAny] = await Promise.all([
    hasUserPermission(session.userId, 'transactions.access'),
    hasUserPermission(session.userId, 'transactions.create'),
    hasUserPermission(session.userId, 'transactions.edit.own'),
    hasUserPermission(session.userId, 'transactions.edit.any'),
    hasUserPermission(session.userId, 'transactions.cancel.own'),
    hasUserPermission(session.userId, 'transactions.cancel.any'),
    hasUserPermission(session.userId, 'transactions.manage.own'),
    hasUserPermission(session.userId, 'transactions.manage.any')
  ]);
  if (!canAccess || (!canCreate && !canEditOwn && !canEditAny && !canCancelOwn && !canCancelAny && !canManageOwn && !canManageAny)) {
    return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, reason, member_label, total_money_in, total_money_out, profit_loss, created_at, transaction_lines(item_name_snapshot, quantity, movement_type, money_effect, stock_effect)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ message: 'Lecture transactions impossible.' }, { status: 500 });

  return NextResponse.json({ transactions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'transactions.access'),
    hasUserPermission(session.userId, 'transactions.create')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    reason?: string;
    member_user_id?: string | null;
    member_label?: string;
    lines?: TxLineInput[];
  };

  if (!body.reason?.trim()) return NextResponse.json({ message: 'Motif requis.' }, { status: 400 });
  if (!body.lines || body.lines.length === 0) return NextResponse.json({ message: 'Ajoutez au moins un item.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'transactions', action: 'create', memberIds: body.member_user_id ? [body.member_user_id] : [] });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  let moneyIn = 0;
  let moneyOut = 0;
  let stockIn = 0;
  let stockOut = 0;

  const resolvedLines: Array<Record<string, unknown>> = [];
  const stockByItem = new Map<number, { name: string; before: number; current: number; }>();
  const stockMovementRows: Array<Record<string, unknown>> = [];

  for (const line of body.lines) {
    const { data: item } = await supabase.from('items').select('id, name, quantity, is_money_item').eq('id', line.item_id).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item ${line.item_id} introuvable.` }, { status: 404 });

    if (!stockByItem.has(item.id)) {
      const before = Number(item.quantity);
      stockByItem.set(item.id, { name: item.name, before, current: before });
    }

    const effects = computeEffects(line, Boolean(item.is_money_item));
    const tracked = stockByItem.get(item.id)!;
    const nextTrackedQuantity = tracked.current + effects.stockEffect;

    if (effects.stockEffect < 0 && nextTrackedQuantity < 0) {
      return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });
    }

    tracked.current = nextTrackedQuantity;

    if (effects.stockEffect !== 0) {
      stockMovementRows.push({
        item_id: item.id,
        item_name: item.name,
        transaction_type: line.movement_type,
        quantity_delta: effects.stockEffect,
        user_id: session.userId
      });
    }

    if (effects.moneyEffect > 0) moneyIn += effects.moneyEffect;
    if (effects.moneyEffect < 0) moneyOut += Math.abs(effects.moneyEffect);
    if (effects.stockEffect > 0) stockIn += effects.stockEffect;
    if (effects.stockEffect < 0) stockOut += Math.abs(effects.stockEffect);

    resolvedLines.push({
      item_id: item.id,
      item_name_snapshot: item.name,
      movement_type: line.movement_type,
      quantity: line.quantity,
      unit_price: item.is_money_item ? 1 : line.unit_price,
      total_amount: effects.total,
      money_effect: effects.moneyEffect,
      stock_effect: effects.stockEffect
    });
  }

  const profitLoss = moneyIn - moneyOut;
  const nextBalance = Number(cash.balance) + moneyIn - moneyOut;
  if (nextBalance < 0) return NextResponse.json({ message: 'Solde groupe insuffisant.' }, { status: 400 });

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      actor_user_id: session.userId,
      member_user_id: body.member_user_id ?? null,
      member_label: body.member_label?.trim() || 'Groupe',
      reason: body.reason.trim(),
      total_money_in: moneyIn,
      total_money_out: moneyOut,
      stock_in_count: stockIn,
      stock_out_count: stockOut,
      profit_loss: profitLoss,
      summary: `${resolvedLines.length} items • ${body.reason.trim()}`
    })
    .select('id')
    .maybeSingle();

  if (txError || !transaction) return NextResponse.json({ message: 'Création transaction impossible.' }, { status: 400 });

  await supabase.from('transaction_lines').insert(resolvedLines.map((line) => ({ ...line, transaction_id: transaction.id })));

  for (const [itemId, state] of stockByItem.entries()) {
    if (state.current !== state.before) {
      await supabase.from('items').update({ quantity: state.current, updated_at: new Date().toISOString() }).eq('id', itemId);
    }
  }

  if (stockMovementRows.length > 0) {
    await supabase.from('item_stock_movements').insert(stockMovementRows.map((row) => ({ ...row, transaction_id: transaction.id })));
  }

  await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  if (moneyIn > 0 || moneyOut > 0) {
    await supabase.from('cash_movements').insert({
      type: 'transaction',
      amount: moneyIn - moneyOut,
      label: `Transaction #${transaction.id} - ${body.reason.trim()}`,
      user_id: session.userId
    });
  }

  const itemsSummary = resolvedLines.map((line) => `${line.item_name_snapshot} x${line.quantity}`).join(', ');
  await createAuditLog({
    actorUserId: session.userId,
    action: 'transactions.create',
    entityType: 'transaction',
    entityId: transaction.id,
    summary: `Transaction ${body.reason.trim()} | Items: ${itemsSummary} | +$${moneyIn.toFixed(2)} / -$${moneyOut.toFixed(2)}`,
    newValues: {
      reason: body.reason.trim(),
      member_label: body.member_label ?? 'Groupe',
      items: resolvedLines,
      moneyIn,
      moneyOut,
      profitLoss
    }
  });

  return NextResponse.json({ ok: true, transactionId: transaction.id });
}
