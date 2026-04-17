import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MoneyPageClient } from '@/components/dashboard/money-page-client';

export default async function MoneyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('money.access')) redirect('/dashboard');
  const canHistoryView = permissions.includes('money.history.view');
  const canQuickSaleAccess = permissions.includes('money.quick_sale.access');
  if (!canHistoryView && !canQuickSaleAccess && !permissions.includes('money.edit')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: cash }, { data: movements }, { data: quickSales }, { data: sellableItems }] = await Promise.all([
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    canHistoryView ? supabase.from('cash_movements').select('id, type, amount, label, created_at, user_id, users(name, username)').order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
    permissions.includes('money.quick_sale.details.view') || canQuickSaleAccess
      ? supabase.from('money_item_sales').select('*').order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    canQuickSaleAccess
      ? supabase.from('items').select('id, name, image_url, quantity, sell_price, category_label, category_key').eq('category_key', 'objects').gt('quantity', 0).order('name', { ascending: true }).limit(300)
      : Promise.resolve({ data: [] })
  ]);

  return (
    <>
      <InternalPageHeader title="Argent" subtitle="Suivi de la caisse du groupe" />
      <MoneyPageClient
        canEdit={permissions.includes('money.edit')}
        initialBalance={Number(cash?.balance ?? 0)}
        initialMovements={movements ?? []}
        quickSales={quickSales ?? []}
        sellableItems={sellableItems ?? []}
        canQuickSaleAccess={canQuickSaleAccess}
        canQuickSaleCreate={permissions.includes('money.quick_sale.create')}
        canQuickSaleDetailsView={permissions.includes('money.quick_sale.details.view')}
      />
    </>
  );
}
