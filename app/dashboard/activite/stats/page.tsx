import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ActivityTabs } from '@/components/activity/activity-tabs';
import { ActivityStatsClient } from '@/components/activity/activity-stats-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type StatsRow = {
  member_user_id: string | null;
  member_label: string | null;
  activity_members?: Array<{ member_user_id: string | null; member_label: string }>;
  activity_type: 'mailbox' | 'burglary' | 'container' | 'processor' | 'cargo' | 'garage' | 'drug_sale';
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
  const [{ data }, { data: itemImages }, { data: activeMembers }] = await Promise.all([
    supabase
      .from('activities')
      .select('member_user_id, member_label, activity_type, equipment_item_id, equipment_item_name, equipment_used, activity_items(item_id, item_name, quantity_added), activity_members(member_user_id, member_label)')
      .neq('activity_type', 'stone')
      .order('created_at', { ascending: false })
      .limit(4000),
    supabase.from('items').select('id, image_url'),
    supabase.from('users').select('id').eq('is_active', true).limit(2000)
  ]);

  const imageByItemId = new Map((itemImages ?? []).map((entry) => [entry.id, entry.image_url]));
  const activeIds = new Set((activeMembers ?? []).map((entry) => entry.id));

  const byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number; cargo: number; garage: number; processor: number; items: Record<string, { quantity: number; imageUrl: string | null }>; equipments: Record<string, { quantity: number; imageUrl: string | null }> }> = {};
  let countedTotal = 0;

  for (const row of (data ?? []) as StatsRow[]) {
    const members = (row.activity_members ?? []).length > 0
      ? (row.activity_members ?? []).filter((entry) => entry.member_user_id && activeIds.has(entry.member_user_id)).map((entry) => entry.member_label || 'Groupe')
      : row.member_user_id && activeIds.has(row.member_user_id) ? [row.member_label || 'Groupe'] : [];
    if (members.length === 0) continue;
    countedTotal += 1;

    for (const member of members) {
      if (!byMember[member]) {
        byMember[member] = { total: 0, mailbox: 0, burglary: 0, container: 0, cargo: 0, garage: 0, processor: 0, items: {}, equipments: {} };
      }

      byMember[member].total += 1;
      if (row.activity_type === 'mailbox') byMember[member].mailbox += 1;
      if (row.activity_type === 'burglary') byMember[member].burglary += 1;
      if (row.activity_type === 'container') byMember[member].container += 1;
      if (row.activity_type === 'cargo') byMember[member].cargo += 1;
      if (row.activity_type === 'garage') byMember[member].garage += 1;
      if (row.activity_type === 'processor') byMember[member].processor += 1;

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
  }

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats Activité" subtitle="Détail des activités, items et équipements par membre" />
      <ActivityTabs active="stats" canSeeStats />
      <ActivityStatsClient byMember={byMember} total={countedTotal} />
    </div>
  );
}
