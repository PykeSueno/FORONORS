import { formatUsd } from '@/lib/currency';
import { getSession } from '@/lib/auth';
import { WelcomeCardActions } from '@/components/dashboard/welcome-card-actions';
import { DashboardHubGrid } from '@/components/dashboard/dashboard-hub-grid';
import { getUserPermissions } from '@/lib/permissions';
import { humanMoneyMovementLabel, humanStockMovementLabel } from '@/lib/labels';
import { getSupabaseAdmin } from '@/lib/supabase';

type DashboardCashRow = {
  type: string;
  amount: number;
  label: string;
  created_at: string;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
};

type DashboardStockRow = {
  item_name: string;
  quantity_delta: number;
  transaction_type: string;
  created_at: string;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
};

const DEFAULT_ORDER = ['money', 'items', 'transactions', 'transactions_recent', 'members', 'logs', 'tablet', 'activity', 'four'];

export default async function DashboardPage() {
  const session = await getSession();
  const permissions = session ? await getUserPermissions(session.userId) : [];

  const has = (perm: string) => permissions.includes(perm);

  const canMoneyAccess = has('money.access');
  const canMoneyPreview = canMoneyAccess || has('money.preview');

  const canItemsAccess = has('items.access');
  const canItemsPreview = canItemsAccess || has('items.preview');

  const canTransactionsAccess = has('transactions.access');
  const canTransactionsPreview = canTransactionsAccess || has('transactions.preview');

  const canTransactionsRecentAccess = has('transactions.recent.access');
  const canTransactionsRecentPreview = canTransactionsRecentAccess || has('transactions.recent.preview');

  const canMembersAccess = has('members.access');
  const canMembersPreview = canMembersAccess || has('members.preview');

  const canLogsAccess = has('logs.access');
  const canLogsPreview = canLogsAccess || has('logs.preview');

  const canTabletAccess = has('tablet.access');
  const canTabletPreview = canTabletAccess || has('tablet.preview');

  const canActivityAccess = has('activity.access');
  const canActivityPreview = canActivityAccess || has('activity.preview');

  const canFourAccess = has('four.access');
  const canFourPreview = canFourAccess || has('four.preview');

  const canShowMoneyMovements = has('dashboard.money.movements.access') || has('dashboard.money.movements.preview') || canMoneyPreview;
  const canShowStockMovements = has('dashboard.stock.movements.access') || has('dashboard.stock.movements.preview') || canItemsPreview;

  const canUpdatePassword = has('account.password.update');

  const supabase = getSupabaseAdmin();
  const [{ data: user }, { data: cash }, { count: itemsCount }, { count: txCount }, { count: membersCount }, { count: logsCount }, { data: recentCash }, { data: recentStock }, { data: fourActive }] = await Promise.all([
    session ? supabase.from('users').select('name, role, dashboard_layout').eq('id', session.userId).maybeSingle() : Promise.resolve({ data: null }),
    canMoneyPreview ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canItemsPreview ? supabase.from('items').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canTransactionsPreview ? supabase.from('transactions').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canMembersPreview ? supabase.from('users').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canLogsPreview ? supabase.from('audit_logs').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
    canShowMoneyMovements ? supabase.from('cash_movements').select('type, amount, label, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canShowStockMovements ? supabase.from('item_stock_movements').select('item_name, quantity_delta, transaction_type, created_at, users(name, username)').order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    canFourPreview ? supabase.from('four_sessions').select('id, status').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null })
  ]);

  const cards = [
    canMoneyPreview ? { id: 'money', href: '/dashboard/argent', enabled: canMoneyAccess, icon: '💰', title: 'Argent', value: formatUsd(Number(cash?.balance ?? 0)), subtitle: 'Caisse actuelle' } : null,
    canItemsPreview ? { id: 'items', href: '/dashboard/items', enabled: canItemsAccess, icon: '📦', title: 'Items', value: String(itemsCount ?? 0), subtitle: 'Catalogue' } : null,
    canTransactionsPreview ? { id: 'transactions', href: '/dashboard/transactions', enabled: canTransactionsAccess, icon: '🔄', title: 'Transactions', value: String(txCount ?? 0), subtitle: 'Créer et gérer' } : null,
    canTransactionsRecentPreview ? { id: 'transactions_recent', href: '/dashboard/transactions-recentes', enabled: canTransactionsRecentAccess, icon: '🕒', title: 'Transactions récentes', value: String(txCount ?? 0), subtitle: 'Historique' } : null,
    canMembersPreview ? { id: 'members', href: '/dashboard/membres', enabled: canMembersAccess, icon: '👥', title: 'Membres', value: String(membersCount ?? 0), subtitle: 'Gestion équipe' } : null,
    canLogsPreview ? { id: 'logs', href: '/dashboard/logs', enabled: canLogsAccess, icon: '🧾', title: 'Logs', value: String(logsCount ?? 0), subtitle: 'Traçabilité' } : null,
    canTabletPreview ? { id: 'tablet', href: '/dashboard/tablette', enabled: canTabletAccess, icon: '📱', title: 'Tablette', value: 'Module', subtitle: 'Passages 8h → 8h' } : null,
    canActivityPreview ? { id: 'activity', href: '/dashboard/activite', enabled: canActivityAccess, icon: '🎯', title: 'Activité', value: 'Module', subtitle: 'Boîte / Cambriolage / Conteneur' } : null,
    canFourPreview ? { id: 'four', href: '/dashboard/four', enabled: canFourAccess, icon: '🔥', title: 'FOUR', value: fourActive ? 'Ouvert' : 'Fermé', subtitle: 'Session vente / achat' } : null
  ].filter(Boolean) as Array<{ id: string; href: string; enabled: boolean; icon: string; title: string; value: string; subtitle: string }>;

  const initialOrder = (Array.isArray(user?.dashboard_layout) ? user?.dashboard_layout.filter((v: unknown) => typeof v === 'string') : DEFAULT_ORDER) as string[];

  const cashRows = (recentCash ?? []) as DashboardCashRow[];
  const stockRows = ((recentStock ?? []) as DashboardStockRow[])
    .map((row) => ({
      created_at: row.created_at,
      member: Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username) || 'Groupe',
      description: `${humanStockMovementLabel(row.transaction_type)} — ${row.item_name}`,
      value: `${row.quantity_delta > 0 ? '+' : ''}${row.quantity_delta}`
    }))
    .slice(0, 4);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[#f6e5cd]">Bienvenue {user?.name || session?.username}</h1>
            <p className="mt-1 text-sm text-[#f1d2ae]">Grade: {user?.role || session?.role || 'Utilisateur'}</p>
          </div>
          <WelcomeCardActions canUpdatePassword={canUpdatePassword} />
        </div>
      </section>

      <DashboardHubGrid cards={cards} initialOrder={initialOrder} />

      <section className="grid gap-4 lg:grid-cols-2">
        {canShowMoneyMovements ? <article className="glass-card p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements d’argent</h2><span className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3]">💰 Cash</span></div>
          <div className="space-y-2">
            {cashRows.slice(0, 4).map((row, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#ffe8c9]">{(Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe'} — {humanMoneyMovementLabel(row.type)} — {row.label}</p>
                  <p className={`text-sm font-semibold ${Number(row.amount) >= 0 ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{formatUsd(Number(row.amount))}</p>
                </div>
                <p className="mt-1 text-xs text-[#f2d2ae]">{new Date(row.created_at).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </article> : null}

        {canShowStockMovements ? <article className="glass-card p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements de stock</h2><span className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3]">📦 Stock</span></div>
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
        </article> : null}
      </section>
    </div>
  );
}
