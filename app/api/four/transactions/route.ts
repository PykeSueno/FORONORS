import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type TxLine = { item_id: number; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number };

function canManageTx(actorId: string, txOwnerId: string | null, canOwn: boolean, canAny: boolean) {
  if (canAny) return true;
  return canOwn && txOwnerId === actorId;
}

function isAllowedFourItem(item: { name: string; category_key: string | null; type_key: string | null }) {
  const name = item.name.toLowerCase();
  const category = (item.category_key ?? '').toLowerCase();
  const type = (item.type_key ?? '').toLowerCase();
  if (category === 'objects') return true;
  if (name.includes('kit')) return true;
  if (name.includes('disqueuse')) return true;
  return category === 'drugs' && type === 'bag';
}

function isValidatedStatus(status: string | null | undefined) {
  return !status || status === 'validated';
}

async function parseResolvedLines(lines: TxLine[]) {
  if (lines.length === 0) throw new Error('Aucune ligne transaction.');
  const supabase = getSupabaseAdmin();
  const resolved: Array<{ itemId: number; itemName: string; movementKind: 'buy' | 'sell'; quantity: number; unitPrice: number; totalAmount: number }> = [];
  let totalPurchases = 0;
  let totalSales = 0;

  for (const line of lines) {
    const itemId = Number(line.item_id);
    const qty = Math.max(1, Number(line.quantity));
    const price = Math.max(0, Number(line.unit_price));
    if (!itemId) throw new Error('Item invalide.');
    const { data: item } = await supabase.from('items').select('id, name, category_key, type_key').eq('id', itemId).maybeSingle();
    if (!item) throw new Error(`Item #${itemId} introuvable.`);
    if (!isAllowedFourItem(item)) throw new Error(`${item.name} n'est pas autorisé dans le FOUR.`);
    const totalAmount = qty * price;
    if (line.movement_kind === 'buy') totalPurchases += totalAmount;
    if (line.movement_kind === 'sell') totalSales += totalAmount;
    resolved.push({ itemId: item.id, itemName: item.name, movementKind: line.movement_kind, quantity: qty, unitPrice: price, totalAmount });
  }

  return { resolved, totalPurchases, totalSales, profitLoss: totalSales - totalPurchases };
}

async function applyTransactionEffect(args: { transactionId: number | null; actorUserId: string; lines: Array<{ itemId: number; itemName: string; movementKind: 'buy' | 'sell'; quantity: number; unitPrice: number; totalAmount: number }>; multiplier: 1 | -1; label: string }) {
  const supabase = getSupabaseAdmin();
  const itemDelta = new Map<number, number>();
  let cashDelta = 0;

  for (const line of args.lines) {
    const direction = line.movementKind === 'buy' ? 1 : -1;
    const stockDelta = direction * line.quantity * args.multiplier;
    const existing = itemDelta.get(line.itemId) ?? 0;
    itemDelta.set(line.itemId, existing + stockDelta);
    const money = (line.movementKind === 'sell' ? line.totalAmount : -line.totalAmount) * args.multiplier;
    cashDelta += money;
  }

  for (const [itemId, delta] of itemDelta.entries()) {
    if (!delta) continue;
    const { data: item } = await supabase.from('items').select('id, quantity').eq('id', itemId).maybeSingle();
    if (!item) throw new Error(`Item #${itemId} introuvable.`);
    const nextQty = Number(item.quantity ?? 0) + delta;
    if (nextQty < 0) throw new Error(`Stock insuffisant sur item #${itemId}.`);
    await supabase.from('items').update({ quantity: nextQty, updated_at: new Date().toISOString() }).eq('id', itemId);
  }

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) throw new Error('Caisse groupe introuvable.');
  const cashBefore = Number(cash.balance ?? 0);
  const cashAfter = cashBefore + cashDelta;
  if (cashAfter < 0) throw new Error('Solde groupe insuffisant.');
  await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: cashDelta >= 0 ? 'entry' : 'exit',
    amount: Math.abs(cashDelta),
    label: args.label,
    user_id: args.actorUserId
  });
  await syncMoneyItemToGroupCash(supabase);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'four.access');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('four_transactions')
    .select('id, counterparty, status, cancel_reason, created_by, total_purchases, total_sales, profit_loss, created_at, updated_at, four_transaction_lines(id, item_id, item_name, movement_kind, quantity, unit_price, total_amount)')
    .order('created_at', { ascending: false })
    .limit(300);
  return NextResponse.json({ transactions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canCreate = await hasUserPermission(session.userId, 'four.transaction.validate');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const body = (await request.json()) as { counterparty?: string; lines?: TxLine[] };

  try {
    const { resolved, totalPurchases, totalSales, profitLoss } = await parseResolvedLines(body.lines ?? []);
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const { data: directSession, error: sessionError } = await supabase
      .from('four_sessions')
      .insert({
        status: 'closed',
        opened_by: session.userId,
        managed_by: session.userId,
        opened_at: nowIso,
        closed_at: nowIso,
        summary: {
          mode: 'direct',
          counterparty: body.counterparty?.trim() || null
        }
      })
      .select('id')
      .maybeSingle();
    if (sessionError || !directSession) {
      return NextResponse.json({ message: 'Création session FOUR impossible.' }, { status: 400 });
    }

    const { data: tx, error: txError } = await supabase
      .from('four_transactions')
      .insert({
        session_id: directSession.id,
        counterparty: body.counterparty?.trim() || null,
        status: 'validated',
        created_by: session.userId,
        total_purchases: totalPurchases,
        total_sales: totalSales,
        profit_loss: profitLoss
      })
      .select('id')
      .maybeSingle();
    if (txError || !tx) return NextResponse.json({ message: 'Validation impossible.' }, { status: 400 });
    const { error: lineError } = await supabase.from('four_transaction_lines').insert(resolved.map((line) => ({
      transaction_id: tx.id,
      item_id: line.itemId,
      item_name: line.itemName,
      movement_kind: line.movementKind,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      total_amount: line.totalAmount
    })));
    if (lineError) return NextResponse.json({ message: 'Enregistrement des lignes FOUR impossible.' }, { status: 400 });
    await applyTransactionEffect({ transactionId: tx.id, actorUserId: session.userId, lines: resolved, multiplier: 1, label: `FOUR transaction #${tx.id}` });
    await createAuditLog({
      actorUserId: session.userId,
      action: 'four.transaction.validate',
      entityType: 'four_transaction',
      entityId: tx.id,
      summary: `FOUR direct · transaction #${tx.id}`,
      newValues: { counterparty: body.counterparty ?? null, totalPurchases, totalSales, profitLoss, lines: resolved }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Validation impossible.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canOwn, canAny, canLegacyOwn, canLegacyAny, canLegacyManage] = await Promise.all([
    hasUserPermission(session.userId, 'four.transaction.edit.own'),
    hasUserPermission(session.userId, 'four.transaction.edit.any'),
    hasUserPermission(session.userId, 'four.transaction.manage.own'),
    hasUserPermission(session.userId, 'four.transaction.manage.any'),
    hasUserPermission(session.userId, 'four.transaction.manage')
  ]);
  const ownAccess = canOwn || canLegacyOwn || canLegacyManage;
  const anyAccess = canAny || canLegacyAny;
  if (!ownAccess && !anyAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { transaction_id?: number; counterparty?: string; lines?: TxLine[] };
  const txId = Number(body.transaction_id);
  if (!txId) return NextResponse.json({ message: 'Transaction invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase
    .from('four_transactions')
    .select('id, status, created_by, four_transaction_lines(item_id, item_name, movement_kind, quantity, unit_price, total_amount)')
    .eq('id', txId)
    .maybeSingle();
  if (!tx) return NextResponse.json({ message: 'Transaction introuvable.' }, { status: 404 });
  if (!canManageTx(session.userId, tx.created_by ?? null, ownAccess, anyAccess)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  if (!isValidatedStatus(tx.status)) return NextResponse.json({ message: 'Transaction non modifiable.' }, { status: 400 });

  try {
    const previousLines = (tx.four_transaction_lines ?? []).map((line) => ({
      itemId: Number(line.item_id),
      itemName: String(line.item_name ?? ''),
      movementKind: line.movement_kind as 'buy' | 'sell',
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.unit_price ?? 0),
      totalAmount: Number(line.total_amount ?? 0)
    }));
    const { resolved, totalPurchases, totalSales, profitLoss } = await parseResolvedLines(body.lines ?? []);
    await applyTransactionEffect({ transactionId: txId, actorUserId: session.userId, lines: previousLines, multiplier: -1, label: `FOUR edit rollback #${txId}` });
    await applyTransactionEffect({ transactionId: txId, actorUserId: session.userId, lines: resolved, multiplier: 1, label: `FOUR edit apply #${txId}` });

    await supabase.from('four_transactions').update({
      counterparty: body.counterparty?.trim() || null,
      total_purchases: totalPurchases,
      total_sales: totalSales,
      profit_loss: profitLoss,
      updated_at: new Date().toISOString()
    }).eq('id', txId);
    await supabase.from('four_transaction_lines').delete().eq('transaction_id', txId);
    await supabase.from('four_transaction_lines').insert(resolved.map((line) => ({
      transaction_id: txId,
      item_id: line.itemId,
      item_name: line.itemName,
      movement_kind: line.movementKind,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      total_amount: line.totalAmount
    })));
    await createAuditLog({
      actorUserId: session.userId,
      action: 'four.transaction.edit',
      entityType: 'four_transaction',
      entityId: txId,
      summary: `Modification transaction FOUR #${txId}`,
      oldValues: { lines: previousLines },
      newValues: { counterparty: body.counterparty?.trim() || null, totalPurchases, totalSales, profitLoss, lines: resolved }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Modification impossible.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canOwn, canAny, canLegacyOwn, canLegacyAny, canLegacyManage] = await Promise.all([
    hasUserPermission(session.userId, 'four.transaction.cancel.own'),
    hasUserPermission(session.userId, 'four.transaction.cancel.any'),
    hasUserPermission(session.userId, 'four.transaction.manage.own'),
    hasUserPermission(session.userId, 'four.transaction.manage.any'),
    hasUserPermission(session.userId, 'four.transaction.manage')
  ]);
  const ownAccess = canOwn || canLegacyOwn || canLegacyManage;
  const anyAccess = canAny || canLegacyAny;
  if (!ownAccess && !anyAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { transaction_id?: number; reason?: string };
  const txId = Number(body.transaction_id);
  if (!txId) return NextResponse.json({ message: 'Transaction invalide.' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase
    .from('four_transactions')
    .select('id, status, created_by, four_transaction_lines(item_id, item_name, movement_kind, quantity, unit_price, total_amount)')
    .eq('id', txId)
    .maybeSingle();
  if (!tx) return NextResponse.json({ message: 'Transaction introuvable.' }, { status: 404 });
  if (!canManageTx(session.userId, tx.created_by ?? null, ownAccess, anyAccess)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  if (!isValidatedStatus(tx.status)) return NextResponse.json({ message: 'Transaction déjà annulée.' }, { status: 400 });

  try {
    const previousLines = (tx.four_transaction_lines ?? []).map((line) => ({
      itemId: Number(line.item_id),
      itemName: String(line.item_name ?? ''),
      movementKind: line.movement_kind as 'buy' | 'sell',
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.unit_price ?? 0),
      totalAmount: Number(line.total_amount ?? 0)
    }));
    await applyTransactionEffect({ transactionId: txId, actorUserId: session.userId, lines: previousLines, multiplier: -1, label: `FOUR annulation #${txId}` });
    await supabase.from('four_transactions').update({
      status: 'canceled',
      cancel_reason: body.reason?.trim() || null,
      canceled_by: session.userId,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', txId);
    await createAuditLog({
      actorUserId: session.userId,
      action: 'four.transaction.cancel',
      entityType: 'four_transaction',
      entityId: txId,
      summary: `Annulation transaction FOUR #${txId}`,
      oldValues: { lines: previousLines },
      newValues: { reason: body.reason?.trim() || null }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Annulation impossible.' }, { status: 400 });
  }
}
