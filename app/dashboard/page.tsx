import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DashboardShellClient } from '@/components/dashboard/dashboard-shell-client';
import { buildPayrollPreview, weekWindow, DEFAULT_PAYROLL_CONFIG } from '@/lib/payroll';

const DEFAULT_ORDER = ['money', 'sale_objects', 'items', 'transactions', 'transactions_recent', 'members', 'logs', 'tablet_cigarette', 'activity', 'four', 'drugs', 'robberies'];

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
  const canCigaretteAccess = has('cigarette.access');
  const canCigarettePreview = canCigaretteAccess || has('cigarette.preview');
  const canTabletCigaretteAccess = canTabletAccess || canCigaretteAccess;
  const canTabletCigarettePreview = canTabletPreview || canCigarettePreview;
  const canActivityAccess = has('activity.access');
  const canActivityPreview = canActivityAccess || has('activity.preview');
  const canFourAccess = has('four.access');
  const canFourPreview = canFourAccess || has('four.preview');
  const canDrugsAccess = has('drugs.access');
  const canDrugsPreview = canDrugsAccess || has('drugs.preview');
  const canSaleObjectsAccess = has('sale.objects.access');
  const canSaleObjectsPreview = canSaleObjectsAccess || has('sale.objects.preview');
  const canRobberiesAccess = has('robberies.view');
  const canRobberiesPreview = canRobberiesAccess;
  const canUpdatePassword = has('account.password.update');
  const canMoneyMovementsView = has('money.movements.view');
  const canStockMovementsView = has('items.movements.view');

  const supabase = getSupabaseAdmin();

  const { data: user } = session
    ? await supabase.from('users').select('name, role, dashboard_layout').eq('id', session.userId).maybeSingle()
    : { data: null };

  const myPayEstimate = session
    ? await (async () => {
        const currentWeek = weekWindow(new Date(), 0);
        const previousWeek = weekWindow(new Date(), -1);
        const [currentPreview, previousPreview] = await Promise.all([
          buildPayrollPreview(supabase, { weekStartIso: currentWeek.startIso, weekEndIso: currentWeek.endIso, config: DEFAULT_PAYROLL_CONFIG }),
          buildPayrollPreview(supabase, { weekStartIso: previousWeek.startIso, weekEndIso: previousWeek.endIso, config: DEFAULT_PAYROLL_CONFIG })
        ]);
        const currentMember = currentPreview.members.find((entry) => entry.memberId === session.userId);
        const previousMember = previousPreview.members.find((entry) => entry.memberId === session.userId);
        return {
          currentEstimate: Number.isFinite(Number(currentMember?.proposedPay)) ? Number(currentMember?.proposedPay ?? 0) : 0,
          previousEstimate: Number.isFinite(Number(previousMember?.proposedPay)) ? Number(previousMember?.proposedPay ?? 0) : 0
        };
      })()
    : { currentEstimate: 0, previousEstimate: 0 };

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
        canTabletCigaretteAccess, canTabletCigarettePreview,
        canActivityAccess, canActivityPreview,
        canFourAccess, canFourPreview,
        canDrugsAccess, canDrugsPreview,
        canSaleObjectsAccess, canSaleObjectsPreview,
        canRobberiesAccess, canRobberiesPreview,
        canMoneyMovementsView, canStockMovementsView
      }}
    />
  );
}
