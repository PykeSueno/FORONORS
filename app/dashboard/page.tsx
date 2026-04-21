import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DashboardShellClient } from '@/components/dashboard/dashboard-shell-client';
import { sortMembersByGrade } from '@/lib/members';

const DEFAULT_ORDER = ['money', 'sale_objects', 'items', 'transactions', 'transactions_recent', 'members', 'logs', 'tablet', 'cigarette', 'activity', 'four', 'drugs'];

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
  const canCigaretteAccess = has('cigarette.access');
  const canCigarettePreview = canCigaretteAccess || has('cigarette.preview');
  const canFourAccess = has('four.access');
  const canFourPreview = canFourAccess || has('four.preview');
  const canDrugsAccess = has('drugs.access');
  const canDrugsPreview = canDrugsAccess || has('drugs.preview');
  const canSaleObjectsAccess = has('sale.objects.access');
  const canSaleObjectsPreview = canSaleObjectsAccess || has('sale.objects.preview');
  const canUpdatePassword = has('account.password.update');
  const canMoneyMovementsView = has('money.movements.view');
  const canStockMovementsView = has('items.movements.view');

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(weekStart);
  const windowStartIso = previousWeekStart.toISOString();
  const weekStartIso = weekStart.toISOString();
  const previousWeekEndIso = previousWeekEnd.toISOString();

  const { data: user } = session
    ? await supabase.from('users').select('name, role, dashboard_layout').eq('id', session.userId).maybeSingle()
    : { data: null };

  const [{ data: members }, { data: cash }, { data: activities }, { data: tabletPassages }, { data: cigarettePassages }, { data: recentTransactions }, { data: drugSales }, { data: fourTransactions }, { data: cashMovements }] = session
    ? await Promise.all([
        supabase.from('users').select('id, name, username, roles(name)').eq('is_active', true),
        supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
        supabase.from('activities').select('member_user_id, created_at, activity_members(member_user_id)').gte('created_at', windowStartIso).limit(4000),
        supabase.from('tablet_passages').select('member_user_id, created_at').not('member_user_id', 'is', null).gte('created_at', windowStartIso),
        supabase.from('cigarette_passages').select('member_user_id, created_at').not('member_user_id', 'is', null).gte('created_at', windowStartIso),
        supabase.from('transactions').select('member_user_id, reason, created_at').not('member_user_id', 'is', null).gte('created_at', windowStartIso).limit(3000),
        supabase.from('drug_sales').select('created_by, created_at').not('created_by', 'is', null).eq('status', 'validated').gte('created_at', windowStartIso).limit(3000),
        supabase.from('four_transactions').select('created_by, created_at').not('created_by', 'is', null).eq('status', 'validated').gte('created_at', windowStartIso).limit(3000),
        supabase.from('cash_movements').select('amount').gte('created_at', windowStartIso).limit(5000)
      ])
    : [{ data: [] }, { data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const currentWeekScore = new Map<string, number>();
  const previousWeekScore = new Map<string, number>();
  const addScore = (target: Map<string, number>, memberId: string | null | undefined, weight: number) => {
    if (!memberId) return;
    target.set(memberId, (target.get(memberId) ?? 0) + weight);
  };
  const applyWeighted = (createdAt: string | null | undefined, memberId: string | null | undefined, weight: number) => {
    if (!createdAt) return;
    if (createdAt >= weekStartIso) addScore(currentWeekScore, memberId, weight);
    else if (createdAt >= windowStartIso && createdAt < previousWeekEndIso) addScore(previousWeekScore, memberId, weight);
  };
  for (const row of (activities ?? []) as Array<{ member_user_id: string | null; created_at?: string; activity_members?: Array<{ member_user_id: string | null }> }>) {
    const memberIds = (row.activity_members ?? []).map((entry) => entry.member_user_id).filter((entry): entry is string => Boolean(entry));
    if (memberIds.length > 0) memberIds.forEach((memberId) => applyWeighted(row.created_at, memberId, 1.2));
    else applyWeighted(row.created_at, row.member_user_id, 0.8);
  }
  for (const row of tabletPassages ?? []) applyWeighted(row.created_at, row.member_user_id, 1.1);
  for (const row of cigarettePassages ?? []) applyWeighted(row.created_at, row.member_user_id, 0.9);
  for (const row of recentTransactions ?? []) {
    if (!row.reason?.toLowerCase().startsWith('paye:')) applyWeighted(row.created_at, row.member_user_id, 0.6);
  }
  for (const row of drugSales ?? []) applyWeighted(row.created_at, row.created_by, 1);
  for (const row of fourTransactions ?? []) applyWeighted(row.created_at, row.created_by, 0.7);

  const maxCurrentScore = Math.max(1, ...Array.from(currentWeekScore.values()));
  const maxPreviousScore = Math.max(1, ...Array.from(previousWeekScore.values()));
  const balance = Number(cash?.balance ?? 0);
  const netFlow = Number((cashMovements ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0));
  const economyFlowFactor = netFlow >= 0 ? Math.min(1.2, 1 + (Math.abs(netFlow) / 100000)) : Math.max(0.85, 1 - (Math.abs(netFlow) / 140000));
  const liquidityFactor = balance >= 100000 ? 1.12 : balance >= 50000 ? 1 : balance >= 20000 ? 0.9 : 0.8;
  const economyIndex = Math.max(0.7, Math.min(1.25, economyFlowFactor * liquidityFactor));
  const sortedMembers = sortMembersByGrade(((members ?? []) as Array<{ id: string; name?: string; username?: string; roles?: { name?: string | null } | { name?: string | null }[] | null }>).map((member) => ({
    ...member,
    role_name: Array.isArray(member.roles) ? member.roles[0]?.name ?? '' : member.roles?.name ?? ''
  })));
  const estimateByMember = Object.fromEntries(sortedMembers.map((member) => {
    const activityIndex = Math.max(0.12, Math.min(1, (currentWeekScore.get(member.id) ?? 0) / maxCurrentScore));
    const previousActivityIndex = Math.max(0.12, Math.min(1, (previousWeekScore.get(member.id) ?? 0) / maxPreviousScore));
    const budgetBase = Math.max(300, Math.min(6000, balance * 0.02));
    const currentEstimate = Math.max(250, Math.min(Math.max(500, balance * 0.2), Math.round(budgetBase * (0.45 + (activityIndex * 0.85)) * economyIndex)));
    const previousEstimate = Math.max(250, Math.min(Math.max(500, balance * 0.2), Math.round(budgetBase * (0.45 + (previousActivityIndex * 0.85)) * economyIndex)));
    return [member.id, { currentEstimate, previousEstimate }];
  }));
  const myPayEstimate = session ? estimateByMember[session.userId] ?? { currentEstimate: 0, previousEstimate: 0 } : { currentEstimate: 0, previousEstimate: 0 };

  const initialOrder = (Array.isArray(user?.dashboard_layout) ? user?.dashboard_layout.filter((value: unknown) => typeof value === 'string') : DEFAULT_ORDER) as string[];

  return (
    <DashboardShellClient
      name={user?.name || session?.username || 'Utilisateur'}
      role={user?.role || session?.role || 'Utilisateur'}
      payEstimateCurrent={myPayEstimate.currentEstimate}
      payEstimatePrevious={myPayEstimate.previousEstimate}
      canUpdatePassword={canUpdatePassword}
      initialOrder={initialOrder}
      flags={{
        canMoneyAccess, canMoneyPreview,
        canItemsAccess, canItemsPreview,
        canTransactionsAccess, canTransactionsPreview,
        canTransactionsRecentAccess, canTransactionsRecentPreview,
        canMembersAccess, canMembersPreview,
        canLogsAccess, canLogsPreview,
        canTabletAccess, canTabletPreview,
        canActivityAccess, canActivityPreview,
        canCigaretteAccess, canCigarettePreview,
        canFourAccess, canFourPreview,
        canDrugsAccess, canDrugsPreview,
        canSaleObjectsAccess, canSaleObjectsPreview,
        canMoneyMovementsView, canStockMovementsView
      }}
    />
  );
}
