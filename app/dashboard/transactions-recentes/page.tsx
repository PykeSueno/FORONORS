import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TransactionsTabs } from '@/components/dashboard/transactions-tabs';
import { formatUsd } from '@/lib/currency';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function RecentTransactionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('transactions.access');
  const canView = permissions.includes('transactions.view');
  const canRecent = permissions.includes('transactions.recent.access');

  if (!canAccess || !canView || !canRecent) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, reason, member_label, total_money_in, total_money_out, profit_loss, created_at, transaction_lines(item_name_snapshot, quantity, movement_type)')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Transactions récentes" subtitle="Historique complet des dernières transactions" />
      <TransactionsTabs active="recent" />
      <section className="glass-card p-5">
        <div className="space-y-2">
          {(transactions ?? []).map((transaction) => (
            <article key={transaction.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f4d4b0]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">#{transaction.id} · {transaction.reason}</p>
                <p>{new Date(transaction.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <p className="mt-1">Membre: {transaction.member_label}</p>
              <p className="mt-1">Items: {transaction.transaction_lines.map((line) => `${line.item_name_snapshot} x${line.quantity}`).join(', ')}</p>
              <p className="mt-1">Entrée {formatUsd(Number(transaction.total_money_in))} · Sortie {formatUsd(Number(transaction.total_money_out))} · Résultat {formatUsd(Number(transaction.profit_loss))}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
