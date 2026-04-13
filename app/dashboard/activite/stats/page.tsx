import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ActivityTabs } from '@/components/activity/activity-tabs';
import { ActivityStatsClient } from '@/components/activity/activity-stats-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type StatsRow = {
  member_label: string | null;
  activity_type: 'mailbox' | 'burglary' | 'container';
  equipment_item_name: string | null;
  equipment_used: number | null;
  activity_items: Array<{ item_name: string; quantity_added: number }>;
};

export default async function ActivityStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('activity.access') || !permissions.includes('activity.stats.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('activities')
    .select('member_label, activity_type, equipment_item_name, equipment_used, activity_items(item_name, quantity_added)')
    .order('created_at', { ascending: false })
    .limit(4000);

  const byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number; items: Record<string, number>; equipments: Record<string, number> }> = {};

  for (const row of (data ?? []) as StatsRow[]) {
    const member = row.member_label || 'Groupe';
    if (!byMember[member]) {
      byMember[member] = { total: 0, mailbox: 0, burglary: 0, container: 0, items: {}, equipments: {} };
    }

    byMember[member].total += 1;
    if (row.activity_type === 'mailbox') byMember[member].mailbox += 1;
    if (row.activity_type === 'burglary') byMember[member].burglary += 1;
    if (row.activity_type === 'container') byMember[member].container += 1;

    for (const item of row.activity_items ?? []) {
      byMember[member].items[item.item_name] = (byMember[member].items[item.item_name] ?? 0) + Number(item.quantity_added ?? 0);
    }

    if (row.equipment_item_name && Number(row.equipment_used ?? 0) > 0) {
      byMember[member].equipments[row.equipment_item_name] = (byMember[member].equipments[row.equipment_item_name] ?? 0) + Number(row.equipment_used ?? 0);
    }
  }

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats Activité" subtitle="Détail des activités, items et équipements par membre" />
      <ActivityTabs active="stats" />
      <ActivityStatsClient byMember={byMember} total={(data ?? []).length} />
    </div>
  );
}
