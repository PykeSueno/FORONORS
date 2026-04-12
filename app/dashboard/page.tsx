import Link from 'next/link';
import { MetricCard } from '@/components/dashboard/metric-card';
import { formatUsd } from '@/lib/currency';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function DashboardPage() {
  const session = await getSession();
  const permissions = session ? await getUserPermissions(session.userId) : [];
  const canAccessMoney = permissions.includes('money.access');
  const canAccessItems = permissions.includes('items.access');
  const canAccessTransactions = permissions.includes('transactions.access') && permissions.includes('transactions.view');

  const supabase = getSupabaseAdmin();
  const [{ data: cash }, { data: latestMovement }, { count: itemsCount }, { count: txCount }, { data: recentCash }, { data: recentStock }] = await Promise.all([
    canAccessMoney ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canAccessMoney
      ? supabase.from('cash_movements').select('type, amount, label').order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    canAccessItems ? supabase.from('items').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canAccessTransactions ? supabase.from('transactions').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canAccessMoney ? supabase.from('cash_movements').select('type, amount, label, created_at').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    canAccessItems ? supabase.from('item_stock_movements').select('item_name, quantity_delta, transaction_type, created_at').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] })
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <h1 className="text-3xl font-semibold text-[#f6e5cd]">Dashboard FORONORS</h1>
        <p className="mt-2 text-sm text-[#f1d2ae]">Résumé utile des modules actifs.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {canAccessMoney ? (
          <Link href="/dashboard/argent" className="block">
            <MetricCard
              label="💰 Argent total"
              value={formatUsd(Number(cash?.balance ?? 0))}
              trend={latestMovement ? `${latestMovement.type} · ${formatUsd(Number(latestMovement.amount))} · ${latestMovement.label}` : 'Aucune activité'}
            />
          </Link>
        ) : null}
        {canAccessItems ? (
          <Link href="/dashboard/items" className="block">
            <MetricCard label="📦 Catalogue Items" value={String(itemsCount ?? 0)} trend="Items enregistrés" />
          </Link>
        ) : null}
        {canAccessTransactions ? (
          <Link href="/dashboard/transactions" className="block">
            <MetricCard label="🔄 Transactions" value={String(txCount ?? 0)} trend="Transactions enregistrées" />
          </Link>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements d’argent</h2>
          <div className="mt-3 space-y-2 text-sm text-[#f2d2ae]">
            {(recentCash ?? []).map((row, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                {row.type} · {formatUsd(Number(row.amount))} · {row.label} · {new Date(row.created_at).toLocaleString('fr-FR')}
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements de stock</h2>
          <div className="mt-3 space-y-2 text-sm text-[#f2d2ae]">
            {(recentStock ?? []).map((row, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                {row.item_name} · {row.quantity_delta > 0 ? '+' : ''}{row.quantity_delta} · {row.transaction_type} · {new Date(row.created_at).toLocaleString('fr-FR')}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
