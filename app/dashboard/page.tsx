import Link from 'next/link';
import { formatUsd } from '@/lib/currency';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { humanMoneyMovementLabel, humanStockMovementLabel } from '@/lib/labels';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function DashboardPage() {
  const session = await getSession();
  const permissions = session ? await getUserPermissions(session.userId) : [];

  const canMoney = permissions.includes('money.access');
  const canItems = permissions.includes('items.access');
  const canTransactions = permissions.includes('transactions.access') && permissions.includes('transactions.view');
  const canTransactionsRecent = canTransactions && permissions.includes('transactions.recent.access');
  const canMembers = permissions.includes('members.access');
  const canLogs = permissions.includes('logs.access') && permissions.includes('logs.view');
  const canTablet = permissions.includes('tablet.access');

  const supabase = getSupabaseAdmin();
  const [{ data: user }, { data: cash }, { count: itemsCount }, { count: txCount }, { count: membersCount }, { count: logsCount }, { data: recentCash }, { data: recentStock }, { data: recentTabletPassages }] = await Promise.all([
    session ? supabase.from('users').select('name, role').eq('id', session.userId).maybeSingle() : Promise.resolve({ data: null }),
    canMoney ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canItems ? supabase.from('items').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canTransactions ? supabase.from('transactions').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canMembers ? supabase.from('users').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canLogs ? supabase.from('audit_logs').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canMoney ? supabase.from('cash_movements').select('type, amount, label, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canItems ? supabase.from('item_stock_movements').select('item_name, quantity_delta, transaction_type, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canTablet ? supabase.from('tablet_passages').select('member_label, created_at').order('created_at', { ascending: false }).limit(4) : Promise.resolve({ data: [] })
  ]);

  const stockRows = [
    ...((recentStock ?? []).map((row) => ({
      type: 'stock' as const,
      created_at: row.created_at,
      member: Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username) || 'Groupe',
      description: `${humanStockMovementLabel(row.transaction_type)} — ${row.item_name}`,
      value: `${row.quantity_delta > 0 ? '+' : ''}${row.quantity_delta}`
    }))),
    ...((recentTabletPassages ?? []).map((row) => ({
      type: 'tablet' as const,
      created_at: row.created_at,
      member: row.member_label || 'Groupe',
      description: 'Passage Tablette — Kit +2 / Disqueuse +2',
      value: '+4'
    })))
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[#f6e5cd]">Bienvenue {user?.name || session?.username}</h1>
            <p className="mt-1 text-sm text-[#f1d2ae]">Grade: {user?.role || session?.role || 'Utilisateur'}</p>
          </div>
          <form action="/api/logout" method="post">
            <button aria-label="Se déconnecter" className="icon-logout-btn">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {canMoney ? <HubCard href="/dashboard/argent" icon="💰" title="Argent" value={formatUsd(Number(cash?.balance ?? 0))} subtitle="Caisse actuelle" /> : null}
        {canItems ? <HubCard href="/dashboard/items" icon="📦" title="Items" value={String(itemsCount ?? 0)} subtitle="Catalogue" /> : null}
        {canTransactions ? <HubCard href="/dashboard/transactions" icon="🔄" title="Transactions" value={String(txCount ?? 0)} subtitle="Créer et gérer" /> : null}
        {canTransactionsRecent ? <HubCard href="/dashboard/transactions-recentes" icon="🕒" title="Transactions récentes" value={String(txCount ?? 0)} subtitle="Historique" /> : null}
        {canMembers ? <HubCard href="/dashboard/membres" icon="👥" title="Membres" value={String(membersCount ?? 0)} subtitle="Gestion équipe" /> : null}
        {canLogs ? <HubCard href="/dashboard/logs" icon="🧾" title="Logs" value={String(logsCount ?? 0)} subtitle="Traçabilité" /> : null}
        {canTablet ? <HubCard href="/dashboard/tablette" icon="📱" title="Tablette" value="Module" subtitle="Passages 8h → 8h" /> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="glass-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements d’argent</h2>
            <span className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3]">💰 Cash</span>
          </div>
          <div className="space-y-2">
            {(recentCash ?? []).slice(0, 4).map((row, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#ffe8c9]">{(Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe'} — {humanMoneyMovementLabel(row.type)} — {row.label}</p>
                  <p className={`text-sm font-semibold ${Number(row.amount) >= 0 ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{formatUsd(Number(row.amount))}</p>
                </div>
                <p className="mt-1 text-xs text-[#f2d2ae]">{new Date(row.created_at).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements de stock</h2>
            <span className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3]">📦 Stock</span>
          </div>
          <div className="space-y-2">
            {stockRows.map((row, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#ffe8c9]">{row.member} — {row.description}</p>
                  <p className={`text-sm font-semibold ${row.value.startsWith('+') ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{row.value}</p>
                </div>
                <p className="mt-1 text-xs text-[#f2d2ae]">{new Date(row.created_at).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function HubCard({ href, icon, title, value, subtitle }: { href: string; icon: string; title: string; value: string; subtitle: string }) {
  return (
    <Link href={href} className="glass-card smooth-hover block p-6">
      <div className="flex items-center justify-between">
        <p className="text-3xl">{icon}</p>
        <p className="text-2xl font-semibold text-[#ffe9cd]">{value}</p>
      </div>
      <p className="mt-3 text-lg font-semibold text-[#fff2de]">{title}</p>
      <p className="text-sm text-[#f1d1ac]">{subtitle}</p>
    </Link>
  );
}
