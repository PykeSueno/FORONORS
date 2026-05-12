import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourTabs } from '@/components/four/four-tabs';
import { FourStatsClient } from '@/components/four/four-stats-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { buildFourStats } from '@/lib/four-stats';

export default async function FourStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access') || !permissions.includes('four.stats.view')) redirect('/dashboard');
  const canSeeTransactions = permissions.includes('four.transaction.validate')
    || permissions.includes('four.transaction.edit.own')
    || permissions.includes('four.transaction.edit.any')
    || permissions.includes('four.transaction.cancel.own')
    || permissions.includes('four.transaction.cancel.any')
    || permissions.includes('four.transaction.manage')
    || permissions.includes('four.transaction.manage.own')
    || permissions.includes('four.transaction.manage.any');

  const { totals, byClient, byMember, byItem, history } = await buildFourStats();

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats FOUR" subtitle="Vue globale, clients, membres, items et historique détaillé" />
      <FourTabs active="stats" canSeeTransactions={canSeeTransactions} canSeeHistory={permissions.includes('four.history.view')} canSeeStats canSeeMessages={permissions.includes('four.messages.view')} canSeePartner={permissions.includes('four.partner.view')} />
      <FourStatsClient totals={totals} byClient={byClient} byMember={byMember} byItem={byItem} history={history} />
    </div>
  );
}
