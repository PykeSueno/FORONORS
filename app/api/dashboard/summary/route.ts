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
  const canMoneyPreview = has('money.preview');

  const canItemsAccess = has('items.access');
  const canItemsPreview = has('items.preview');

  const canTransactionsAccess = has('transactions.access');
  const canTransactionsPreview = has('transactions.preview');

  const canMembersAccess = has('members.access');
  const canMembersPreview = has('members.preview');
  const canExpensesPreview = has('expenses.view');

  const canLogsAccess = has('logs.access');
  const canLogsPreview = has('logs.preview');

  const canSaleObjectsAccess = has('sale.objects.access');
  const canSaleObjectsPreview = has('sale.objects.preview');
  const canCigaretteAccess = has('cigarette.access');
  const canCigarettePreview = canCigaretteAccess || has('cigarette.preview');
  const canTabletAccess = has('tablet.access');
  const canTabletPreview = canTabletAccess || has('tablet.preview');
  const canProcessorPreview = has('tobacco.processor.view');
  const canActivityAccess = has('activity.access');
  const canActivityPreview = has('activity.preview');
  const canFourAccess = has('four.access');
  const canFourPreview = has('four.preview');

  const canShowMoneyMovements = has('dashboard.money.movements.access') || has('dashboard.money.movements.preview');
  const canShowStockMovements = has('dashboard.stock.movements.access') || has('dashboard.stock.movements.preview');
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

  const [{ data: cash }, { data: itemsStockTotalRes }, { count: txCount }, { count: membersCount }, { count: logsCount }, { data: recentCash }, { data: recentStock }, { data: moneyItem }, { data: saleObjectsTodayRows }, { data: cigaretteToday }, { data: tabletToday }, { data: processorTodayRows }, { data: activitiesTodayRows }, { data: activeMembersForCounts }, { data: fourTodayRows }, { data: pendingExpensesRows }] = await Promise.all([
    canMoneyPreview ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canItemsPreview ? supabase.rpc('get_items_stock_total') : Promise.resolve({ data: 0 }),
    canTransactionsPreview ? supabase.from('transactions').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canMembersPreview ? supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true) : Promise.resolve({ count: null }),
    canLogsPreview ? supabase.from('audit_logs').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canShowMoneyMovements ? supabase.from('cash_movements').select('type, amount, label, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canShowStockMovements ? supabase.from('item_stock_movements').select('item_id, item_name, quantity_delta, transaction_type, created_at, users(name, username), items(image_url, quantity)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canShowMoneyMovements ? supabase.from('items').select('image_url').eq('is_money_item', true).order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canSaleObjectsPreview
      ? supabase.from('sale_object_orders').select('id, created_by').neq('status', 'canceled').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      : Promise.resolve({ data: [] }),
    canCigarettePreview
      ? supabase.from('cigarette_passages').select('member_user_id, revenue_amount').eq('business_day', cigaretteBusinessDay).eq('status', 'validated')
      : Promise.resolve({ data: [] }),
    canTabletPreview
      ? supabase.from('tablet_days').select('id, tablet_passages(member_user_id)').eq('business_day', tabletBusinessDay).maybeSingle()
      : Promise.resolve({ data: null }),
    canProcessorPreview
      ? supabase.from('processor_sessions').select('id, participant_user_ids').eq('status', 'validated').gte('created_at', dayStartIso)
      : Promise.resolve({ data: [] }),
    canActivityPreview
      ? supabase.from('activities').select('id, member_user_id, activity_members(member_user_id)').gte('created_at', activityDayStart.toISOString()).lt('created_at', activityDayEnd.toISOString())
      : Promise.resolve({ data: [] }),
    (canSaleObjectsPreview || canCigarettePreview || canTabletPreview || canProcessorPreview || canActivityPreview || canFourPreview || canExpensesPreview)
      ? supabase.from('users').select('id').eq('is_active', true).limit(2000)
      : Promise.resolve({ data: [] }),
    canFourPreview
      ? supabase.from('four_transactions').select('total_purchases, total_sales, created_by').or('status.eq.validated,status.is.null').gte('created_at', dayStartIso)
      : Promise.resolve({ data: [] }),
    canExpensesPreview
      ? supabase.from('expenses').select('amount, member_id').eq('status', 'pending')
      : Promise.resolve({ data: [] })

  ]);
  const itemsStockTotal = Number((itemsStockTotalRes as number | string | null) ?? 0);
  const activeIds = new Set((activeMembersForCounts ?? []).map((row: { id: string }) => row.id));
  const saleObjectsToday = ((saleObjectsTodayRows ?? []) as Array<{ created_by?: string | null }>).filter((row) => row.created_by && activeIds.has(row.created_by)).length;
  const fourToday = ((fourTodayRows ?? []) as Array<{ total_purchases: number | null; total_sales: number | null; created_by?: string | null }>).filter((row) => row.created_by && activeIds.has(row.created_by)).reduce((acc, row) => {
    acc.purchases += Number(row.total_purchases ?? 0);
    acc.sales += Number(row.total_sales ?? 0);
    return acc;
  }, { purchases: 0, sales: 0 });
  const processorToday = ((processorTodayRows ?? []) as Array<{ participant_user_ids?: string[] | null }>).filter((row) => Array.isArray(row.participant_user_ids) && row.participant_user_ids.some((id) => activeIds.has(id))).length;
  const activitiesToday = ((activitiesTodayRows ?? []) as Array<{ member_user_id?: string | null; activity_members?: Array<{ member_user_id: string | null }> }>).filter((row) => {
    if (row.member_user_id && activeIds.has(row.member_user_id)) return true;
    return (row.activity_members ?? []).some((entry) => entry.member_user_id && activeIds.has(entry.member_user_id));
  }).length;
  const cigaretteTodayRows = ((cigaretteToday ?? []) as Array<{ member_user_id?: string | null; revenue_amount?: number | null }>).filter((row) => row.member_user_id && activeIds.has(row.member_user_id));
  const tabletPassagesToday = (((tabletToday as { tablet_passages?: Array<{ member_user_id?: string | null }> } | null)?.tablet_passages ?? [])).filter((row) => row.member_user_id && activeIds.has(row.member_user_id)).length;
  const expensesPendingTotal = ((pendingExpensesRows ?? []) as Array<{ amount?: number | null; member_id?: string | null }>).filter((row) => row.member_id && activeIds.has(row.member_id)).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return NextResponse.json({
    canShowMoneyMovements,
    canShowStockMovements,
    values: {
      cashBalance: Number(cash?.balance ?? 0),
      expensesPendingTotal,
      itemsCount: itemsStockTotal,
      txCount: txCount ?? 0,
      membersCount: membersCount ?? 0,
      logsCount: logsCount ?? 0,
      saleObjectsToday: Number(saleObjectsToday),
      tabletPassagesToday: Number(tabletPassagesToday),
      processorOperationsToday: Number(processorToday),
      activitiesToday: Number(activitiesToday),
      cigarettePassagesToday: Number(cigaretteTodayRows.length),
      cigaretteRevenueToday: cigaretteTodayRows.reduce((sum, row) => sum + Number(row.revenue_amount ?? 0), 0),
      fourPurchasesToday: Number(fourToday.purchases),
      fourSalesToday: Number(fourToday.sales),
      fourProfitToday: Number(fourToday.sales - fourToday.purchases)
    },
    moneyItemImageUrl: moneyItem?.image_url ?? null,
    recentCash: recentCash ?? [],
    recentStock: recentStock ?? []
  });
}
