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
  equipment_item_id: number | null;
  equipment_item_name: string | null;
  equipment_used: number | null;
  activity_items: Array<{ item_id: number | null; item_name: string; quantity_added: number }>;
};

export default async function ActivityStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('activity.stats.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data }, { data: itemImages }] = await Promise.all([
    supabase
      .from('activities')
      .select('member_label, activity_type, equipment_item_id, equipment_item_name, equipment_used, activity_items(item_id, item_name, quantity_added)')
      .order('created_at', { ascending: false })
      .limit(4000),
    supabase.from('items').select('id, image_url')
  ]);

  const imageByItemId = new Map((itemImages ?? []).map((entry) => [entry.id, entry.image_url]));

  const byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number; items: Record<string, { quantity: number; imageUrl: string | null }>; equipments: Record<string, { quantity: number; imageUrl: string | null }> }> = {};

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
      const current = byMember[member].items[item.item_name] ?? { quantity: 0, imageUrl: item.item_id ? (imageByItemId.get(item.item_id) ?? null) : null };
      current.quantity += Number(item.quantity_added ?? 0);
      byMember[member].items[item.item_name] = current;
    }

    if (row.equipment_item_name && Number(row.equipment_used ?? 0) > 0) {
      const current = byMember[member].equipments[row.equipment_item_name] ?? { quantity: 0, imageUrl: row.equipment_item_id ? (imageByItemId.get(row.equipment_item_id) ?? null) : null };
      current.quantity += Number(row.equipment_used ?? 0);
      byMember[member].equipments[row.equipment_item_name] = current;
    }
  }

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats Activité" subtitle="Détail des activités, items et équipements par membre" />
      <ActivityTabs active="stats" canSeeStats />
      <ActivityStatsClient byMember={byMember} total={(data ?? []).length} />
    </div>
  );
}
