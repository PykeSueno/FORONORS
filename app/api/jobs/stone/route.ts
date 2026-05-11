import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

const STONE_ITEM_NAME = 'Saphir Brut';
const STONE_UNIT_PRICE = 225;
const STONE_DAILY_LIMIT = 8;

function todayWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canView, canSell] = await Promise.all([
    hasUserPermission(session.userId, 'jobs.stone.view'),
    hasUserPermission(session.userId, 'jobs.stone.sell')
  ]);
  if (!canView || !canSell) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = await request.json() as { member_user_id?: string; member_label?: string; quantity?: number };
  const memberId = String(body.member_user_id ?? '');
  const quantity = Math.max(0, Math.floor(Number(body.quantity ?? 0)));
  if (!memberId || quantity <= 0) return NextResponse.json({ message: 'Membre / quantité invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'stone', action: 'sell', memberIds: [memberId] });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }

  const { startIso, endIso } = todayWindow();
  const [{ data: item }, { data: cash }, { data: todayRows }] = await Promise.all([
    supabase.from('items').select('id, name, quantity').eq('name', STONE_ITEM_NAME).maybeSingle(),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle(),
    supabase.from('stone_sales').select('quantity_sold').eq('member_user_id', memberId).gte('created_at', startIso).lt('created_at', endIso).limit(100)
  ]);

  if (!item) return NextResponse.json({ message: 'Item Saphir Brut introuvable dans le stock.' }, { status: 404 });
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const soldToday = (todayRows ?? []).reduce((sum, row) => sum + Number(row.quantity_sold ?? 0), 0);
  const remaining = Math.max(0, STONE_DAILY_LIMIT - soldToday);
  if (quantity > remaining) return NextResponse.json({ message: `Limite journalière dépassée. Restant possible: ${remaining}.` }, { status: 400 });

  const stockBefore = Number(item.quantity ?? 0);
  if (quantity > stockBefore) return NextResponse.json({ message: 'Stock Saphir Brut insuffisant.' }, { status: 400 });

  const total = quantity * STONE_UNIT_PRICE;
  const stockAfter = stockBefore - quantity;
  const cashBefore = Number(cash.balance ?? 0);
  const cashAfter = cashBefore + total;
  const memberLabel = String(body.member_label ?? '').trim() || session.username;

  const { data: sale, error } = await supabase.from('stone_sales').insert({
    member_user_id: memberId,
    member_label: memberLabel,
    item_id: item.id,
    item_name: STONE_ITEM_NAME,
    quantity_sold: quantity,
    unit_price: STONE_UNIT_PRICE,
    total_amount: total,
    stock_before: stockBefore,
    stock_after: stockAfter,
    cash_before: cashBefore,
    cash_after: cashAfter,
    created_by: session.userId
  }).select('*').maybeSingle();

  if (error || !sale) return NextResponse.json({ message: 'Validation vente pierre impossible.' }, { status: 400 });

  await Promise.all([
    supabase.from('items').update({ quantity: stockAfter, updated_at: new Date().toISOString() }).eq('id', item.id),
    supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('item_stock_movements').insert({ item_id: item.id, item_name: STONE_ITEM_NAME, quantity_delta: -quantity, transaction_type: 'stone_sale', user_id: memberId }),
    supabase.from('cash_movements').insert({ type: 'stone_sale', amount: total, label: `Vente Pierre - ${STONE_ITEM_NAME} x${quantity}`, user_id: memberId, before_amount: cashBefore, after_amount: cashAfter, related_item_name: STONE_ITEM_NAME }),
    syncMoneyItemToGroupCash(supabase)
  ]);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'jobs.stone.sale_created',
    entityType: 'stone_sale',
    entityId: sale.id,
    summary: `Vente Pierre ${STONE_ITEM_NAME} x${quantity} par ${memberLabel}`,
    newValues: { sale, soldTodayBefore: soldToday, remainingBefore: remaining, stockBefore, stockAfter, cashBefore, cashAfter }
  });

  return NextResponse.json({
    sale,
    soldToday: soldToday + quantity,
    remainingToday: Math.max(0, STONE_DAILY_LIMIT - soldToday - quantity),
    stoneStock: stockAfter,
    groupCash: cashAfter
  });
}
