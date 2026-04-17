import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

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

  const canFourAccess = has('four.access');
  const canFourPreview = canFourAccess || has('four.preview');

  const canSaleObjectsAccess = has('sale.objects.access');
  const canSaleObjectsPreview = canSaleObjectsAccess || has('sale.objects.preview');

  const canShowMoneyMovements = has('dashboard.money.movements.access') || has('dashboard.money.movements.preview') || canMoneyPreview;
  const canShowStockMovements = has('dashboard.stock.movements.access') || has('dashboard.stock.movements.preview') || canItemsPreview;

  const supabase = getSupabaseAdmin();
  const [{ data: cash }, { count: itemsCount }, { count: txCount }, { count: membersCount }, { count: logsCount }, { data: recentCash }, { data: recentStock }, { data: fourActive }, { data: moneyItem }, { count: saleObjectsToday }] = await Promise.all([
    canMoneyPreview ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canItemsPreview ? supabase.from('items').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canTransactionsPreview ? supabase.from('transactions').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canMembersPreview ? supabase.from('users').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canLogsPreview ? supabase.from('audit_logs').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canShowMoneyMovements ? supabase.from('cash_movements').select('type, amount, label, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canShowStockMovements ? supabase.from('item_stock_movements').select('item_id, item_name, quantity_delta, transaction_type, created_at, users(name, username), items(image_url)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canFourPreview ? supabase.from('four_sessions').select('id, status').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canShowMoneyMovements ? supabase.from('items').select('image_url').eq('is_money_item', true).order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canSaleObjectsPreview
      ? supabase.from('sale_object_orders').select('id', { count: 'exact', head: true }).neq('status', 'canceled').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      : Promise.resolve({ count: 0 })

  ]);

  return NextResponse.json({
    canShowMoneyMovements,
    canShowStockMovements,
    values: {
      cashBalance: Number(cash?.balance ?? 0),
      itemsCount: itemsCount ?? 0,
      txCount: txCount ?? 0,
      membersCount: membersCount ?? 0,
      logsCount: logsCount ?? 0,
      fourOpen: Boolean(fourActive),
      saleObjectsToday: Number(saleObjectsToday ?? 0)
    },
    moneyItemImageUrl: moneyItem?.image_url ?? null,
    recentCash: recentCash ?? [],
    recentStock: recentStock ?? []
  });
}
