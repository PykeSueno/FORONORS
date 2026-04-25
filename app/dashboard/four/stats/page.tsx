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

  const { totals, byClient, byMember, byItem, history } = await buildFourStats();

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats FOUR" subtitle="Vue globale, clients, membres, items et historique détaillé" />
      <FourTabs active="stats" canSeeStats canSeeMessages={permissions.includes('four.messages.view')} />
      <FourStatsClient totals={totals} byClient={byClient} byMember={byMember} byItem={byItem} history={history} />
    </div>
  );
}
