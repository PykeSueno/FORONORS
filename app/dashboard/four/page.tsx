import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourPageClient } from '@/components/four/four-page-client';
import { FourTabs } from '@/components/four/four-tabs';

export default async function FourPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access')) redirect('/dashboard');
  const canSeeTransactions = permissions.includes('four.transaction.validate')
    || permissions.includes('four.transaction.edit.own')
    || permissions.includes('four.transaction.edit.any')
    || permissions.includes('four.transaction.cancel.own')
    || permissions.includes('four.transaction.cancel.any')
    || permissions.includes('four.transaction.manage')
    || permissions.includes('four.transaction.manage.own')
    || permissions.includes('four.transaction.manage.any');
  if (!canSeeTransactions) {
    if (permissions.includes('four.partner.view')) redirect('/dashboard/four/partenaire');
    if (permissions.includes('four.history.view')) redirect('/dashboard/four/historique');
    if (permissions.includes('four.stats.view')) redirect('/dashboard/four/stats');
    if (permissions.includes('four.messages.view')) redirect('/dashboard/four/messages');
    redirect('/dashboard');
  }

  const supabase = getSupabaseAdmin();
  const [{ data: items }, { data: transactions }, { data: cash }] = await Promise.all([
    supabase.from('items').select('id, name, image_url, quantity, buy_price, sell_price, category_key, type_key').order('name', { ascending: true }),
    supabase
      .from('four_transactions')
      .select('id, counterparty, status, cancel_reason, created_by, total_purchases, total_sales, profit_loss, created_at, updated_at, four_transaction_lines(id, item_id, item_name, movement_kind, quantity, unit_price, total_amount)')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle()
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="FOUR" subtitle="Transactions stock + argent" />
      <FourTabs
        active="four"
        canSeeTransactions={canSeeTransactions}
        canSeeHistory={permissions.includes('four.history.view')}
        canSeeStats={permissions.includes('four.stats.view')}
        canSeeMessages={permissions.includes('four.messages.view')}
        canSeePartner={permissions.includes('four.partner.view')}
      />
      <FourPageClient
        items={items ?? []}
        initialTransactions={transactions ?? []}
        initialCashBalance={Number(cash?.balance ?? 0)}
        canCreate={permissions.includes('four.transaction.validate')}
        canEditOwn={permissions.includes('four.transaction.edit.own') || permissions.includes('four.transaction.manage.own') || permissions.includes('four.transaction.manage')}
        canEditAny={permissions.includes('four.transaction.edit.any') || permissions.includes('four.transaction.manage.any')}
        canCancelOwn={permissions.includes('four.transaction.cancel.own') || permissions.includes('four.transaction.manage.own') || permissions.includes('four.transaction.manage')}
        canCancelAny={permissions.includes('four.transaction.cancel.any') || permissions.includes('four.transaction.manage.any')}
        currentUserId={session.userId}
      />
    </div>
  );
}
