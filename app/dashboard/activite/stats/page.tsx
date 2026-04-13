import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ActivityTabs } from '@/components/activity/activity-tabs';
import { ActivityStatsClient } from '@/components/activity/activity-stats-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function ActivityStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('activity.access') || !permissions.includes('activity.stats.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('activities').select('member_label, activity_type').order('created_at', { ascending: false }).limit(4000);

  const byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number }> = {};
  for (const row of data ?? []) {
    const member = row.member_label || 'Groupe';
    if (!byMember[member]) byMember[member] = { total: 0, mailbox: 0, burglary: 0, container: 0 };
    byMember[member].total += 1;
    if (row.activity_type === 'mailbox') byMember[member].mailbox += 1;
    if (row.activity_type === 'burglary') byMember[member].burglary += 1;
    if (row.activity_type === 'container') byMember[member].container += 1;
  }

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats Activité" subtitle="Répartition des activités par membre" />
      <ActivityTabs active="stats" />
      <ActivityStatsClient byMember={byMember} total={(data ?? []).length} />
    </div>
  );
}
