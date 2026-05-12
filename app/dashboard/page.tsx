import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DashboardShellClient } from '@/components/dashboard/dashboard-shell-client';

const DEFAULT_ORDER = ['money', 'sale_objects', 'items', 'transactions', 'members', 'activity_payroll', 'logs', 'tablet_cigarette', 'activity', 'four', 'drugs', 'robberies'];

export default async function DashboardPage() {
  const session = await getSession();
  const permissions = session ? await getUserPermissions(session.userId) : [];
  const has = (perm: string) => permissions.includes(perm);

  const canMoneyAccess = has('money.access');
  const canMoneyPreview = has('money.preview');
  const canItemsAccess = has('items.access');
  const canItemsPreview = has('items.preview');
  const canTransactionsAccess = has('transactions.access');
  const canTransactionsPreview = has('transactions.preview');
  const canTransactionsRecentAccess = false;
  const canTransactionsRecentPreview = false;
  const canMembersAccess = has('members.access');
  const canMembersPreview = has('members.preview');
  const canActivityPayrollAccess = has('member_ops.view') || has('activity_payroll.view');
  const canActivityPayrollPreview = canActivityPayrollAccess;
  const canExpensesAccess = false;
  const canExpensesPreview = false;
  const canLogsAccess = has('logs.access');
  const canLogsPreview = has('logs.preview');
  const canTabletAccess = has('tablet.access');
  const canTabletPreview = canTabletAccess || has('tablet.preview');
  const canCigaretteAccess = has('cigarette.access');
  const canCigarettePreview = canCigaretteAccess || has('cigarette.preview');
  const canProcessorAccess = has('tobacco.processor.view');
  const canStoneAccess = has('jobs.stone.view');
  const canTabletCigaretteAccess = canTabletAccess || canCigaretteAccess || canProcessorAccess || canStoneAccess;
  const canTabletCigarettePreview = canTabletPreview || canCigarettePreview || canProcessorAccess || canStoneAccess;
  const canActivityAccess = has('activity.access');
  const canActivityPreview = has('activity.preview');
  const canFourAccess = has('four.access');
  const canFourPreview = has('four.preview');
  const canDrugsAccess = has('drugs.access');
  const canDrugsPreview = has('drugs.preview');
  const canSaleObjectsAccess = has('sale.objects.access');
  const canSaleObjectsPreview = has('sale.objects.preview');
  const canRobberiesAccess = has('robberies.view');
  const canRobberiesPreview = canRobberiesAccess;
  const canUpdatePassword = has('account.password.update');
  const canMoneyMovementsView = has('money.movements.view');
  const canStockMovementsView = has('items.movements.view');

  const supabase = getSupabaseAdmin();

  const { data: user } = session
    ? await supabase.from('users').select('name, role, dashboard_layout').eq('id', session.userId).maybeSingle()
    : { data: null };

  const initialOrder = (Array.isArray(user?.dashboard_layout) ? user?.dashboard_layout.filter((value: unknown) => typeof value === 'string') : DEFAULT_ORDER) as string[];

  return (
    <DashboardShellClient
      name={user?.name || session?.username || 'Utilisateur'}
      role={user?.role || session?.role || 'Utilisateur'}
      payEstimateCurrent={0}
      payEstimatePrevious={0}
      canUpdatePassword={canUpdatePassword}
      initialOrder={initialOrder}
      flags={{
        canMoneyAccess, canMoneyPreview,
        canItemsAccess, canItemsPreview,
        canTransactionsAccess, canTransactionsPreview,
        canTransactionsRecentAccess, canTransactionsRecentPreview,
        canMembersAccess, canMembersPreview,
        canActivityPayrollAccess, canActivityPayrollPreview,
        canExpensesAccess, canExpensesPreview,
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
