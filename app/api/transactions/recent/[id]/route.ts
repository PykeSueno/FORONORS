import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type TxLine = {
  item_id: number | null;
  item_name_snapshot: string;
  movement_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  money_effect: number;
  stock_effect: number;
};

async function applyDeltaToItems(lines: TxLine[], multiplier: 1 | -1) {
  const supabase = getSupabaseAdmin();

  for (const line of lines) {
    if (!line.item_id) continue;
    if (line.stock_effect === 0) continue;

    const { data: item } = await supabase.from('items').select('id, quantity').eq('id', line.item_id).maybeSingle();
    if (!item) return { ok: false, message: `Item introuvable pour correction: ${line.item_name_snapshot}.` };

    const nextQuantity = Number(item.quantity) + Number(line.stock_effect) * multiplier;
    if (nextQuantity < 0) return { ok: false, message: `Stock insuffisant pour corriger ${line.item_name_snapshot}.` };

    await supabase.from('items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', line.item_id);
  }

  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canEditOwn, canEditAny, canLegacyOwn, canLegacyAny] = await Promise.all([
    hasUserPermission(session.userId, 'transactions.recent.access'),
    hasUserPermission(session.userId, 'transactions.recent.edit.own'),
    hasUserPermission(session.userId, 'transactions.recent.edit.any'),
    hasUserPermission(session.userId, 'transactions.recent.manage.own'),
    hasUserPermission(session.userId, 'transactions.recent.manage.any')
  ]);
  const canOwn = canEditOwn || canLegacyOwn;
  const canAny = canEditAny || canLegacyAny;
  if (!canAccess || (!canOwn && !canAny)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const txId = Number(id);
  const body = (await request.json()) as { reason?: string; member_label?: string; lines?: Array<{ item_id: number; movement_type: 'purchase' | 'sale' | 'stock_in' | 'stock_out'; quantity: number; unit_price: number; manual_total?: number | null }> };
  if (!body.reason?.trim() || !body.lines?.length) return NextResponse.json({ message: 'Motif et lignes requis.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase
    .from('transactions')
    .select('id, actor_user_id, reason, member_label, total_money_in, total_money_out, profit_loss, transaction_lines(item_id, item_name_snapshot, movement_type, quantity, unit_price, total_amount, money_effect, stock_effect)')
    .eq('id', txId)
    .maybeSingle();

  if (!tx) return NextResponse.json({ message: 'Transaction introuvable.' }, { status: 404 });
  if (!canAny && tx.actor_user_id !== session.userId) return NextResponse.json({ message: 'Vous pouvez modifier uniquement vos propres transactions.' }, { status: 403 });

  const oldLines = (tx.transaction_lines ?? []) as TxLine[];

  const rollback = await applyDeltaToItems(oldLines, -1);
  if (!rollback.ok) return NextResponse.json({ message: rollback.message }, { status: 400 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  const oldNet = Number(tx.total_money_in) - Number(tx.total_money_out);
  const balanceAfterRollback = Number(cash.balance) - oldNet;

  const newLines: TxLine[] = [];
  let moneyIn = 0;
  let moneyOut = 0;
  let stockIn = 0;
  let stockOut = 0;

  for (const line of body.lines) {
    const { data: item } = await supabase.from('items').select('id, name, quantity, is_money_item').eq('id', line.item_id).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item ${line.item_id} introuvable.` }, { status: 404 });

    const qty = Math.max(1, Number(line.quantity));
    const unitPrice = Math.max(0, Number(line.unit_price));
    const isMoney = Boolean(item.is_money_item);
    const computedTotal = qty * unitPrice;
    const manualTotal = line.manual_total === null || line.manual_total === undefined ? NaN : Number(line.manual_total);
    const total = isMoney ? qty : Number.isFinite(manualTotal) && manualTotal >= 0 ? manualTotal : computedTotal;

    let stockEffect = 0;
    let moneyEffect = 0;

    if (isMoney) {
      moneyEffect = line.movement_type === 'purchase' || line.movement_type === 'stock_out' ? -total : total;
    } else if (line.movement_type === 'purchase') {
      stockEffect = qty;
      moneyEffect = -total;
    } else if (line.movement_type === 'sale') {
      stockEffect = -qty;
      moneyEffect = total;
    } else if (line.movement_type === 'stock_in') {
      stockEffect = qty;
    } else {
      stockEffect = -qty;
    }

    const nextQuantity = Number(item.quantity) + stockEffect;
    if (nextQuantity < 0) return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });

    if (stockEffect !== 0) {
      await supabase.from('items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', item.id);
      await supabase.from('item_stock_movements').insert({
        item_id: item.id,
        item_name: item.name,
        transaction_id: txId,
        transaction_type: `transaction_edit_${line.movement_type}`,
        quantity_delta: stockEffect,
        user_id: session.userId
      });
      if (stockEffect > 0) stockIn += stockEffect;
      if (stockEffect < 0) stockOut += Math.abs(stockEffect);
    }

    if (moneyEffect > 0) moneyIn += moneyEffect;
    if (moneyEffect < 0) moneyOut += Math.abs(moneyEffect);

    newLines.push({
      item_id: item.id,
      item_name_snapshot: item.name,
      movement_type: line.movement_type,
      quantity: qty,
      unit_price: isMoney ? 1 : unitPrice,
      total_amount: total,
      money_effect: moneyEffect,
      stock_effect: stockEffect
    });
  }

  const newNet = moneyIn - moneyOut;
  const nextBalance = balanceAfterRollback + newNet;
  if (nextBalance < 0) return NextResponse.json({ message: 'Solde groupe insuffisant après correction.' }, { status: 400 });

  await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  await supabase.from('transaction_lines').delete().eq('transaction_id', txId);
  await supabase.from('transaction_lines').insert(newLines.map((line) => ({ ...line, transaction_id: txId })));

  await supabase.from('transactions').update({
    reason: body.reason.trim(),
    member_label: body.member_label?.trim() || tx.member_label,
    total_money_in: moneyIn,
    total_money_out: moneyOut,
    stock_in_count: stockIn,
    stock_out_count: stockOut,
    profit_loss: newNet,
    summary: `${newLines.length} items • ${body.reason.trim()}`,
    updated_at: new Date().toISOString()
  }).eq('id', txId);

  await supabase.from('cash_movements').insert({
    type: 'transaction_edit',
    amount: newNet - oldNet,
    label: `Correction transaction #${txId}`,
    user_id: session.userId
  });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'transactions.recent.edit',
    entityType: 'transaction',
    entityId: txId,
    summary: `Correction transaction #${txId}`,
    oldValues: tx as Record<string, unknown>,
    newValues: { reason: body.reason, member_label: body.member_label, lines: newLines, moneyIn, moneyOut, newNet }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCancelOwn, canCancelAny, canLegacyOwn, canLegacyAny] = await Promise.all([
    hasUserPermission(session.userId, 'transactions.recent.access'),
    hasUserPermission(session.userId, 'transactions.recent.cancel.own'),
    hasUserPermission(session.userId, 'transactions.recent.cancel.any'),
    hasUserPermission(session.userId, 'transactions.recent.manage.own'),
    hasUserPermission(session.userId, 'transactions.recent.manage.any')
  ]);
  const canOwn = canCancelOwn || canLegacyOwn;
  const canAny = canCancelAny || canLegacyAny;
  if (!canAccess || (!canOwn && !canAny)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const txId = Number(id);

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase
    .from('transactions')
    .select('id, actor_user_id, reason, total_money_in, total_money_out, transaction_lines(item_id, item_name_snapshot, stock_effect, movement_type, quantity)')
    .eq('id', txId)
    .maybeSingle();

  if (!tx) return NextResponse.json({ message: 'Transaction introuvable.' }, { status: 404 });
  if (!canAny && tx.actor_user_id !== session.userId) return NextResponse.json({ message: 'Vous pouvez annuler uniquement vos propres transactions.' }, { status: 403 });

  const lines = (tx.transaction_lines ?? []) as TxLine[];
  const rollback = await applyDeltaToItems(lines, -1);
  if (!rollback.ok) return NextResponse.json({ message: rollback.message }, { status: 400 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  const net = Number(tx.total_money_in) - Number(tx.total_money_out);
  const nextBalance = Number(cash.balance) - net;
  if (nextBalance < 0) return NextResponse.json({ message: 'Solde groupe insuffisant pour annuler.' }, { status: 400 });

  await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  await supabase.from('cash_movements').insert({
    type: 'transaction_cancel',
    amount: -net,
    label: `Annulation transaction #${txId}`,
    user_id: session.userId
  });

  await supabase.from('transactions').delete().eq('id', txId);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'transactions.recent.cancel',
    entityType: 'transaction',
    entityId: txId,
    summary: `Annulation transaction #${txId}`,
    oldValues: tx as Record<string, unknown>,
    newValues: { balanceAfter: nextBalance }
  });

  return NextResponse.json({ ok: true });
}
