import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourHistoryClient } from '@/components/four/four-history-client';
import { FourTabs } from '@/components/four/four-tabs';
import { getSession } from '@/lib/auth';
import { buildFourStats } from '@/lib/four-stats';
import { getUserPermissions } from '@/lib/permissions';

export default async function FourHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access') || !permissions.includes('four.history.view')) redirect('/dashboard');
  const canSeeTransactions = permissions.includes('four.transaction.validate')
    || permissions.includes('four.transaction.edit.own')
    || permissions.includes('four.transaction.edit.any')
    || permissions.includes('four.transaction.cancel.own')
    || permissions.includes('four.transaction.cancel.any')
    || permissions.includes('four.transaction.manage')
    || permissions.includes('four.transaction.manage.own')
    || permissions.includes('four.transaction.manage.any');
  const { history } = await buildFourStats();

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Historique FOUR" subtitle="Transactions validées, achats, ventes et lignes détaillées" />
      <FourTabs
        active="history"
        canSeeTransactions={canSeeTransactions}
        canSeeHistory
        canSeeStats={permissions.includes('four.stats.view')}
        canSeeMessages={permissions.includes('four.messages.view')}
        canSeePartner={permissions.includes('four.partner.view')}
      />
      <FourHistoryClient history={history} />
    </div>
  );
}
