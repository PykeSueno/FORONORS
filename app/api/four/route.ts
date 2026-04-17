import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasUserPermission } from '@/lib/permissions';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

async function ensureAccess(permission: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: 'Non autorisé.' }, { status: 401 }) };
  const ok = await hasUserPermission(session.userId, permission);
  if (!ok) return { error: NextResponse.json({ message: 'Accès refusé.' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const access = await ensureAccess('four.access');
  if ('error' in access) return access.error;

  const canHistory = await hasUserPermission(access.session.userId, 'four.history.view');
  const supabase = getSupabaseAdmin();
  const { data: active } = await supabase
    .from('four_sessions')
    .select('id, status, managed_by, opened_at, closed_at, summary, users:managed_by(name, username), four_transactions(id, counterparty, status, cancel_reason, created_by, canceled_by, canceled_at, total_purchases, total_sales, profit_loss, created_at, updated_at, four_transaction_lines(id, item_id, item_name, movement_kind, quantity, unit_price, total_amount))')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const history = canHistory
    ? (await supabase
        .from('four_sessions')
        .select('id, status, opened_at, closed_at, summary, users:managed_by(name, username)')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(25)).data ?? []
    : [];

  return NextResponse.json({ active: active ?? null, history });
}

export async function POST(request: Request) {
  const access = await ensureAccess('four.open');
  if ('error' in access) return access.error;

  const supabase = getSupabaseAdmin();
  const { data: active } = await supabase.from('four_sessions').select('id').eq('status', 'open').limit(1).maybeSingle();
  if (active) return NextResponse.json({ message: 'Une session FOUR est déjà ouverte.' }, { status: 409 });

  const body = (await request.json()) as { managed_by?: string; initial_cash?: number };
  const managedBy = body.managed_by ?? access.session.userId;
  const initialCash = Math.max(0, Number(body.initial_cash ?? 0));

  const { data: created, error } = await supabase
    .from('four_sessions')
    .insert({ status: 'open', opened_by: access.session.userId, managed_by: managedBy, summary: { initial_cash: initialCash, cash_added_total: 0 } })
    .select('id, managed_by, opened_at, status, summary')
    .maybeSingle();

  if (error || !created) return NextResponse.json({ message: 'Ouverture FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.open',
    entityType: 'four_session',
    entityId: created.id,
    summary: `Ouverture session FOUR #${created.id}`,
    newValues: created as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, session: created });
}

export async function PATCH(request: Request) {
  const access = await ensureAccess('four.close');
  if ('error' in access) return access.error;

  const body = (await request.json()) as { session_id?: number };
  const sessionId = Number(body.session_id);
  if (!sessionId) return NextResponse.json({ message: 'Session invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: session } = await supabase
    .from('four_sessions')
    .select('id, status, summary, four_transactions(id, status, total_purchases, total_sales, four_transaction_lines(item_id, movement_kind, quantity))')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.status !== 'open') return NextResponse.json({ message: 'Session introuvable ou déjà fermée.' }, { status: 404 });

  const itemDelta = new Map<number, number>();
  let totalPurchases = 0;
  let totalSales = 0;

  for (const tx of session.four_transactions ?? []) {
    if (tx.status && tx.status !== 'validated') continue;
    totalPurchases += Number(tx.total_purchases ?? 0);
    totalSales += Number(tx.total_sales ?? 0);
    for (const line of tx.four_transaction_lines ?? []) {
      if (!line.item_id) continue;
      const current = itemDelta.get(line.item_id) ?? 0;
      if (line.movement_kind === 'sell') itemDelta.set(line.item_id, current - Number(line.quantity ?? 0));
      if (line.movement_kind === 'buy') itemDelta.set(line.item_id, current + Number(line.quantity ?? 0));
    }
  }

  const itemMovementRows: Array<{ item_id: number; item_name: string; quantity_delta: number }> = [];
  for (const [itemId, delta] of itemDelta.entries()) {
    if (delta === 0) continue;
    const { data: item } = await supabase.from('items').select('id, name, quantity').eq('id', itemId).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item #${itemId} introuvable.` }, { status: 404 });
    const next = Number(item.quantity) + delta;
    if (next < 0) return NextResponse.json({ message: `Stock insuffisant pour l'item #${itemId}.` }, { status: 400 });
    await supabase.from('items').update({ quantity: next, updated_at: new Date().toISOString() }).eq('id', itemId);
    itemMovementRows.push({ item_id: itemId, item_name: item.name, quantity_delta: delta });
  }

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });
  const cashDelta = totalSales - totalPurchases;
  const nextBalance = Number(cash.balance) + cashDelta;
  if (nextBalance < 0) return NextResponse.json({ message: 'Solde insuffisant pour clôturer FOUR.' }, { status: 400 });
  await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: cashDelta >= 0 ? 'entry' : 'exit',
    amount: Math.abs(cashDelta),
    label: `Clôture FOUR #${sessionId} (${cashDelta >= 0 ? 'gain' : 'perte'})`,
    user_id: access.session.userId
  });
  await syncMoneyItemToGroupCash(supabase);

  const { data: globalTx } = await supabase
    .from('transactions')
    .insert({
      actor_user_id: access.session.userId,
      member_user_id: null,
      member_label: 'Groupe',
      reason: `Clôture FOUR #${sessionId}`,
      total_money_in: totalSales,
      total_money_out: totalPurchases,
      stock_in_count: itemMovementRows.filter((row) => row.quantity_delta > 0).reduce((sum, row) => sum + row.quantity_delta, 0),
      stock_out_count: Math.abs(itemMovementRows.filter((row) => row.quantity_delta < 0).reduce((sum, row) => sum + row.quantity_delta, 0)),
      profit_loss: cashDelta,
      summary: `FOUR #${sessionId} clôturé · Achats ${totalPurchases}$ · Ventes ${totalSales}$ · Résultat ${cashDelta}$`
    })
    .select('id')
    .maybeSingle();

  if (globalTx?.id) {
    await supabase.from('transaction_lines').insert(
      itemMovementRows.map((row) => ({
        transaction_id: globalTx.id,
        item_id: row.item_id,
        item_name_snapshot: row.item_name,
        movement_type: row.quantity_delta > 0 ? 'stock_in' : 'stock_out',
        quantity: Math.abs(row.quantity_delta),
        unit_price: 0,
        total_amount: 0,
        money_effect: 0,
        stock_effect: row.quantity_delta,
        metadata: { source: 'four_close', session_id: sessionId }
      }))
    );

    await supabase.from('item_stock_movements').insert(
      itemMovementRows.map((row) => ({
        item_id: row.item_id,
        transaction_id: globalTx.id,
        item_name: row.item_name,
        transaction_type: 'four_close',
        quantity_delta: row.quantity_delta,
        user_id: access.session.userId
      }))
    );
  }

  const initialCash = Number((session.summary as Record<string, unknown> | null)?.initial_cash ?? 0);
  const cashAdded = Number((session.summary as Record<string, unknown> | null)?.cash_added_total ?? 0);
  const cashFinal = initialCash + cashAdded + cashDelta;

  await supabase.from('four_sessions').update({
    status: 'closed',
    closed_at: new Date().toISOString(),
    summary: {
      ...(session.summary as Record<string, unknown> | null),
      total_purchases: totalPurchases,
      total_sales: totalSales,
      profit_loss: cashDelta,
      cash_final: cashFinal,
      item_delta: Object.fromEntries(itemDelta)
    }
  }).eq('id', sessionId);

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.close',
    entityType: 'four_session',
    entityId: sessionId,
    summary: `Clôture session FOUR #${sessionId}`,
    newValues: { initialCash, cashAdded, totalPurchases, totalSales, profit: cashDelta, cashFinal, itemDelta: Object.fromEntries(itemDelta) }
  });

  return NextResponse.json({ ok: true });
}
