import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type TxLine = { item_id: number; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canManage, canValidate] = await Promise.all([
    hasUserPermission(session.userId, 'four.transaction.manage'),
    hasUserPermission(session.userId, 'four.transaction.validate')
  ]);
  if (!canManage || !canValidate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { session_id?: number; counterparty?: string; lines?: TxLine[] };
  const sessionId = Number(body.session_id);
  const lines = body.lines ?? [];
  if (!sessionId || lines.length === 0) return NextResponse.json({ message: 'Transaction FOUR invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: fourSession } = await supabase.from('four_sessions').select('id, status').eq('id', sessionId).maybeSingle();
  if (!fourSession || fourSession.status !== 'open') return NextResponse.json({ message: 'Session FOUR non active.' }, { status: 400 });

  let totalPurchases = 0;
  let totalSales = 0;
  const resolved: Array<{ item_id: number; item_name: string; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number; total_amount: number }> = [];

  for (const line of lines) {
    const itemId = Number(line.item_id);
    const qty = Math.max(1, Number(line.quantity));
    const price = Math.max(0, Number(line.unit_price));
    if (!itemId) return NextResponse.json({ message: 'Item invalide.' }, { status: 400 });

    const { data: item } = await supabase.from('items').select('id, name').eq('id', itemId).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item ${itemId} introuvable.` }, { status: 404 });

    const total = qty * price;
    if (line.movement_kind === 'buy') totalPurchases += total;
    if (line.movement_kind === 'sell') totalSales += total;

    resolved.push({ item_id: item.id, item_name: item.name, movement_kind: line.movement_kind, quantity: qty, unit_price: price, total_amount: total });
  }

  const { data: createdTx, error: txError } = await supabase
    .from('four_transactions')
    .insert({
      session_id: sessionId,
      created_by: session.userId,
      counterparty: body.counterparty?.trim() || null,
      total_purchases: totalPurchases,
      total_sales: totalSales,
      profit_loss: totalSales - totalPurchases
    })
    .select('id, session_id, counterparty, total_purchases, total_sales, profit_loss, created_at')
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
    entityType: 'four_session',
    entityId: sessionId,
    summary: `Validation transaction FOUR #${createdTx.id}`,
    newValues: {
      counterparty: createdTx.counterparty,
      totalPurchases,
      totalSales,
      profitLoss: totalSales - totalPurchases,
      lines: resolved
    }
  });

  return NextResponse.json({ ok: true, transaction: createdTx });
}
