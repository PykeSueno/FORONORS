import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TransactionsTabs } from '@/components/dashboard/transactions-tabs';
import { RecentTransactionsClient } from '@/components/transactions/recent-transactions-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type RecentTransaction = {
  id: number;
  reason: string;
  member_label: string;
  total_money_in: number;
  total_money_out: number;
  profit_loss: number;
  created_at: string;
  transaction_lines: Array<{
    item_name_snapshot: string;
    quantity: number;
    movement_type: 'purchase' | 'sale' | 'stock_in' | 'stock_out';
    item_id?: number;
    unit_price?: number;
    items: { image_url: string | null } | Array<{ image_url: string | null }> | null;
  }>;
};

export default async function RecentTransactionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('transactions.access');
  const canView = permissions.includes('transactions.view');
  const canRecent = permissions.includes('transactions.recent.access');

  if (!canAccess || !canView || !canRecent) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('transactions')
    .select('id, reason, member_label, total_money_in, total_money_out, profit_loss, created_at, transaction_lines(item_name_snapshot, quantity, movement_type, item_id, unit_price, items(image_url))')
    .order('created_at', { ascending: false })
    .limit(200);
  const transactions = (data ?? []) as RecentTransaction[];

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Transactions récentes" subtitle="Historique complet des dernières transactions" />
      <TransactionsTabs active="recent" />
      <RecentTransactionsClient
        transactions={transactions}
        canEditRecent={permissions.includes('transactions.recent.edit')}
        canCancelRecent={permissions.includes('transactions.recent.cancel')}
      />
    </div>
  );
}
