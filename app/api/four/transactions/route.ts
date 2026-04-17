import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type TxLine = { item_id: number; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number };

async function ensureSessionOpen(supabase: ReturnType<typeof getSupabaseAdmin>, requestedSessionId?: number) {
  if (requestedSessionId) {
    const { data } = await supabase.from('four_sessions').select('id, status').eq('id', requestedSessionId).maybeSingle();
    if (data?.status === 'open') return data.id as number;
  }
  const { data: active } = await supabase.from('four_sessions').select('id, status').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
  if (active?.status === 'open') return active.id as number;
  return null;
}

function canManageTx(actorId: string, txOwnerId: string | null, canOwn: boolean, canAny: boolean) {
  if (canAny) return true;
  if (canOwn && txOwnerId && txOwnerId === actorId) return true;
  return false;
}

async function resolveLines(supabase: ReturnType<typeof getSupabaseAdmin>, lines: TxLine[]) {
  let totalPurchases = 0;
  let totalSales = 0;
  const resolved: Array<{ item_id: number; item_name: string; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number; total_amount: number }> = [];

  for (const line of lines) {
    const itemId = Number(line.item_id);
    const qty = Math.max(1, Number(line.quantity));
    const price = Math.max(0, Number(line.unit_price));
    if (!itemId) throw new Error('Item invalide.');

    const { data: item } = await supabase.from('items').select('id, name').eq('id', itemId).maybeSingle();
    if (!item) throw new Error(`Item ${itemId} introuvable.`);

    const total = qty * price;
    if (line.movement_kind === 'buy') totalPurchases += total;
    if (line.movement_kind === 'sell') totalSales += total;
    resolved.push({ item_id: item.id, item_name: item.name, movement_kind: line.movement_kind, quantity: qty, unit_price: price, total_amount: total });
  }

  return { totalPurchases, totalSales, resolved };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAddMovement, canValidate] = await Promise.all([
    hasUserPermission(session.userId, 'four.add_movement'),
    hasUserPermission(session.userId, 'four.transaction.validate')
  ]);
  if (!canAddMovement || !canValidate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { session_id?: number; counterparty?: string; lines?: TxLine[] };
  const lines = body.lines ?? [];
  if (lines.length === 0) return NextResponse.json({ message: 'Transaction FOUR invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const sessionId = await ensureSessionOpen(supabase, Number(body.session_id));
  if (!sessionId) return NextResponse.json({ message: 'Session FOUR non active.' }, { status: 400 });

  try {
    const { totalPurchases, totalSales, resolved } = await resolveLines(supabase, lines);
    const { data: createdTx, error: txError } = await supabase
      .from('four_transactions')
      .insert({
        session_id: sessionId,
        created_by: session.userId,
        counterparty: body.counterparty?.trim() || null,
        status: 'validated',
        total_purchases: totalPurchases,
        total_sales: totalSales,
        profit_loss: totalSales - totalPurchases,
        updated_at: new Date().toISOString()
      })
      .select('id, session_id, counterparty, status, created_by, total_purchases, total_sales, profit_loss, created_at, updated_at')
      .maybeSingle();

    if (txError || !createdTx) return NextResponse.json({ message: 'Validation transaction FOUR impossible.' }, { status: 400 });

    await supabase.from('four_transaction_lines').insert(
      resolved.map((line) => ({
        transaction_id: createdTx.id,
        item_id: line.item_id,
        item_name: line.item_name,
        movement_kind: line.movement_kind,
        quantity: line.quantity,
        unit_price: line.unit_price,
        total_amount: line.total_amount
      }))
    );

    await createAuditLog({
      actorUserId: session.userId,
      action: 'four.transaction.validate',
      entityType: 'four_transaction',
      entityId: createdTx.id,
      summary: `Validation transaction FOUR #${createdTx.id}`,
      newValues: { counterparty: createdTx.counterparty, totalPurchases, totalSales, profitLoss: totalSales - totalPurchases, lines: resolved }
    });

    return NextResponse.json({ ok: true, transaction: createdTx });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Validation impossible.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canOwn, canAny, canLegacyManage] = await Promise.all([
    hasUserPermission(session.userId, 'four.transaction.manage.own'),
    hasUserPermission(session.userId, 'four.transaction.manage.any'),
    hasUserPermission(session.userId, 'four.transaction.manage')
  ]);
  const ownAccess = canOwn || canLegacyManage;
  if (!ownAccess && !canAny) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { transaction_id?: number; counterparty?: string; lines?: TxLine[] };
  const txId = Number(body.transaction_id);
  if (!txId) return NextResponse.json({ message: 'Transaction invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase.from('four_transactions').select('id, status, created_by, session_id').eq('id', txId).maybeSingle();
  if (!tx) return NextResponse.json({ message: 'Transaction introuvable.' }, { status: 404 });
  if (!canManageTx(session.userId, tx.created_by ?? null, ownAccess, canAny)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  if (tx.status !== 'validated') return NextResponse.json({ message: 'Seules les transactions validées peuvent être modifiées.' }, { status: 400 });

  const sessionId = await ensureSessionOpen(supabase, tx.session_id);
  if (!sessionId) return NextResponse.json({ message: 'Session FOUR non active.' }, { status: 400 });

  const lines = body.lines ?? [];
  if (lines.length === 0) return NextResponse.json({ message: 'Aucune ligne à enregistrer.' }, { status: 400 });

  try {
    const { totalPurchases, totalSales, resolved } = await resolveLines(supabase, lines);

    await supabase.from('four_transactions').update({
      counterparty: body.counterparty?.trim() || null,
      total_purchases: totalPurchases,
      total_sales: totalSales,
      profit_loss: totalSales - totalPurchases,
      updated_at: new Date().toISOString()
    }).eq('id', txId);

    await supabase.from('four_transaction_lines').delete().eq('transaction_id', txId);
    await supabase.from('four_transaction_lines').insert(resolved.map((line) => ({
      transaction_id: txId,
      item_id: line.item_id,
      item_name: line.item_name,
      movement_kind: line.movement_kind,
      quantity: line.quantity,
      unit_price: line.unit_price,
      total_amount: line.total_amount
    })));

    await createAuditLog({
      actorUserId: session.userId,
      action: 'four.transaction.update',
      entityType: 'four_transaction',
      entityId: txId,
      summary: `Modification transaction FOUR #${txId}`,
      newValues: { totalPurchases, totalSales, profitLoss: totalSales - totalPurchases, lines: resolved }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Modification impossible.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canOwn, canAny, canLegacyManage] = await Promise.all([
    hasUserPermission(session.userId, 'four.transaction.manage.own'),
    hasUserPermission(session.userId, 'four.transaction.manage.any'),
    hasUserPermission(session.userId, 'four.transaction.manage')
  ]);
  const ownAccess = canOwn || canLegacyManage;
  if (!ownAccess && !canAny) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { transaction_id?: number; reason?: string };
  const txId = Number(body.transaction_id);
  if (!txId) return NextResponse.json({ message: 'Transaction invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase.from('four_transactions').select('id, session_id, status, created_by').eq('id', txId).maybeSingle();
  if (!tx) return NextResponse.json({ message: 'Transaction introuvable.' }, { status: 404 });
  if (!canManageTx(session.userId, tx.created_by ?? null, ownAccess, canAny)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const sessionId = await ensureSessionOpen(supabase, tx.session_id);
  if (!sessionId) return NextResponse.json({ message: 'Session FOUR non active.' }, { status: 400 });
  if (tx.status !== 'validated') return NextResponse.json({ message: 'Transaction déjà annulée.' }, { status: 400 });

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
    newValues: { status: 'canceled', reason: body.reason?.trim() || null }
  });

  return NextResponse.json({ ok: true });
}
