import Image from 'next/image';
import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TransactionsTabs } from '@/components/dashboard/transactions-tabs';
import { formatUsd } from '@/lib/currency';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { humanStockMovementLabel } from '@/lib/labels';
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
    .select('id, reason, member_label, total_money_in, total_money_out, profit_loss, created_at, transaction_lines(item_name_snapshot, quantity, movement_type, item_id, items(image_url))')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Transactions récentes" subtitle="Historique complet des dernières transactions" />
      <TransactionsTabs active="recent" />
      <section className="space-y-3">
        {(transactions ?? []).map((transaction) => (
          <article key={transaction.id} className="glass-card border-l-4 border-l-[#f1c792] p-4 text-sm text-[#f4d4b0]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold">🔄 #{transaction.id} · {transaction.reason}</p>
              <p className="text-xs">{new Date(transaction.created_at).toLocaleString('fr-FR')}</p>
            </div>
            <p className="mt-1 text-xs text-[#f6d8b7]">👤 {transaction.member_label}</p>

            <div className="mt-3 grid gap-2">
              {transaction.transaction_lines.map((line, index) => {
                const imageUrl = Array.isArray(line.items) ? line.items[0]?.image_url : line.items?.image_url;
                return (
                  <div key={index} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#3d2619]/60 px-3 py-2">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#23140e]">
                      {imageUrl ? <Image src={imageUrl} alt={line.item_name_snapshot} width={48} height={48} className="h-full w-full object-cover" unoptimized /> : null}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#ffe8ca]">{line.item_name_snapshot} x{line.quantity}</p>
                      <p className="text-xs text-[#efd0aa]">{humanStockMovementLabel(line.movement_type)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs">
              <p className="rounded-xl bg-[#83d89f]/10 px-3 py-2 text-[#cbf5d6]">Entrée: {formatUsd(Number(transaction.total_money_in))}</p>
              <p className="rounded-xl bg-[#e08f8f]/10 px-3 py-2 text-[#f8caca]">Sortie: {formatUsd(Number(transaction.total_money_out))}</p>
              <p className={`rounded-xl px-3 py-2 ${Number(transaction.profit_loss) >= 0 ? 'bg-[#83d89f]/10 text-[#cbf5d6]' : 'bg-[#e08f8f]/10 text-[#f8caca]'}`}>Résultat: {formatUsd(Number(transaction.profit_loss))}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
