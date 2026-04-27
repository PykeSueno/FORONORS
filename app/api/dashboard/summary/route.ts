import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCigaretteBusinessDate } from '@/lib/cigarette';
import { getTabletBusinessDate } from '@/lib/tablet';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const permissions = await getUserPermissions(session.userId);
  const has = (perm: string) => permissions.includes(perm);

  const canMoneyAccess = has('money.access');
  const canMoneyPreview = canMoneyAccess || has('money.preview');

  const canItemsAccess = has('items.access');
  const canItemsPreview = canItemsAccess || has('items.preview');

  const canTransactionsAccess = has('transactions.access');
  const canTransactionsPreview = canTransactionsAccess || has('transactions.preview');

  const canMembersAccess = has('members.access');
  const canMembersPreview = canMembersAccess || has('members.preview');

  const canLogsAccess = has('logs.access');
  const canLogsPreview = canLogsAccess || has('logs.preview');

  const canSaleObjectsAccess = has('sale.objects.access');
  const canSaleObjectsPreview = canSaleObjectsAccess || has('sale.objects.preview');
  const canCigaretteAccess = has('cigarette.access');
  const canCigarettePreview = canCigaretteAccess || has('cigarette.preview');
  const canTabletAccess = has('tablet.access');
  const canTabletPreview = canTabletAccess || has('tablet.preview');
  const canProcessorPreview = has('tobacco.processor.view');
  const canActivityAccess = has('activity.access');
  const canActivityPreview = canActivityAccess || has('activity.preview');
  const canFourAccess = has('four.access');
  const canFourPreview = canFourAccess || has('four.preview');

  const canShowMoneyMovements = has('dashboard.money.movements.access') || has('dashboard.money.movements.preview') || canMoneyPreview;
  const canShowStockMovements = has('dashboard.stock.movements.access') || has('dashboard.stock.movements.preview') || canItemsPreview;
  const cigaretteBusinessDay = getCigaretteBusinessDate();
  const tabletBusinessDay = getTabletBusinessDate();
  const activityDayStart = new Date();
  activityDayStart.setHours(0, 0, 0, 0);
  const activityDayEnd = new Date(activityDayStart);
  activityDayEnd.setDate(activityDayEnd.getDate() + 1);

  const supabase = getSupabaseAdmin();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const [{ data: cash }, { data: itemQuantities }, { count: txCount }, { count: membersCount }, { count: logsCount }, { data: recentCash }, { data: recentStock }, { data: moneyItem }, { count: saleObjectsToday }, { data: cigaretteToday }, { data: tabletToday }, { count: processorToday }, { count: activitiesToday }, { data: fourTodayRows }] = await Promise.all([
    canMoneyPreview ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canItemsPreview ? supabase.from('items').select('quantity') : Promise.resolve({ data: [] }),
    canTransactionsPreview ? supabase.from('transactions').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canMembersPreview ? supabase.from('users').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canLogsPreview ? supabase.from('audit_logs').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canShowMoneyMovements ? supabase.from('cash_movements').select('type, amount, label, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canShowStockMovements ? supabase.from('item_stock_movements').select('item_id, item_name, quantity_delta, transaction_type, created_at, users(name, username), items(image_url, quantity)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canShowMoneyMovements ? supabase.from('items').select('image_url').eq('is_money_item', true).order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canSaleObjectsPreview
      ? supabase.from('sale_object_orders').select('id', { count: 'exact', head: true }).neq('status', 'canceled').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      : Promise.resolve({ count: 0 }),
    canCigarettePreview
      ? supabase.from('cigarette_days').select('passages_count, total_revenue').eq('business_day', cigaretteBusinessDay).maybeSingle()
      : Promise.resolve({ data: null }),
    canTabletPreview
      ? supabase.from('tablet_days').select('passages_count').eq('business_day', tabletBusinessDay).maybeSingle()
      : Promise.resolve({ data: null }),
    canProcessorPreview
      ? supabase.from('processor_sessions').select('id', { count: 'exact', head: true }).eq('status', 'validated').gte('created_at', dayStartIso)
      : Promise.resolve({ count: 0 }),
    canActivityPreview
      ? supabase.from('activities').select('id', { count: 'exact', head: true }).gte('created_at', activityDayStart.toISOString()).lt('created_at', activityDayEnd.toISOString())
      : Promise.resolve({ count: 0 }),
    canFourPreview
      ? supabase.from('four_transactions').select('total_purchases, total_sales').or('status.eq.validated,status.is.null').gte('created_at', dayStartIso)
      : Promise.resolve({ data: [] })

  ]);
  const itemsStockTotal = Number(((itemQuantities ?? []) as Array<{ quantity: number | null }>).reduce((acc, item) => acc + Number(item.quantity ?? 0), 0));
  const fourToday = ((fourTodayRows ?? []) as Array<{ total_purchases: number | null; total_sales: number | null }>).reduce((acc, row) => {
    acc.purchases += Number(row.total_purchases ?? 0);
    acc.sales += Number(row.total_sales ?? 0);
    return acc;
  }, { purchases: 0, sales: 0 });

  return NextResponse.json({
    canShowMoneyMovements,
    canShowStockMovements,
    values: {
      cashBalance: Number(cash?.balance ?? 0),
      itemsCount: itemsStockTotal,
      txCount: txCount ?? 0,
      membersCount: membersCount ?? 0,
      logsCount: logsCount ?? 0,
      saleObjectsToday: Number(saleObjectsToday ?? 0),
      tabletPassagesToday: Number(tabletToday?.passages_count ?? 0),
      processorOperationsToday: Number(processorToday ?? 0),
      activitiesToday: Number(activitiesToday ?? 0),
      cigarettePassagesToday: Number(cigaretteToday?.passages_count ?? 0),
      cigaretteRevenueToday: Number(cigaretteToday?.total_revenue ?? 0),
      fourPurchasesToday: Number(fourToday.purchases),
      fourSalesToday: Number(fourToday.sales),
      fourProfitToday: Number(fourToday.sales - fourToday.purchases)
    },
    moneyItemImageUrl: moneyItem?.image_url ?? null,
    recentCash: recentCash ?? [],
    recentStock: recentStock ?? []
  });
}
