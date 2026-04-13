import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ActivityTabs } from '@/components/activity/activity-tabs';
import { ActivityPageClient } from '@/components/activity/activity-page-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type ActivityRow = {
  id: number;
  activity_type: 'mailbox' | 'burglary' | 'container';
  member_user_id: string | null;
  member_label: string;
  proof_image_url: string | null;
  equipment_item_name: string | null;
  equipment_used: number;
  equipment_before: number;
  equipment_after: number;
  created_at: string;
  activity_items: Array<{
    item_id: number | null;
    item_name: string;
    quantity_added: number;
    before_quantity: number;
    after_quantity: number;
    item_image_url: string | null;
  }>;
};

type ActivityDbRow = Omit<ActivityRow, 'activity_items'> & {
  activity_items: Array<{
    item_id: number | null;
    item_name: string;
    quantity_added: number;
    before_quantity: number;
    after_quantity: number;
  }>;
};

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('activity.access');
  const canView = permissions.includes('activity.view');
  if (!canAccess) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: items }, { data: members }, { data: activities }] = await Promise.all([
    supabase.from('items').select('id, name, image_url, quantity, category_key, type_key').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase
      .from('activities')
      .select('id, activity_type, member_user_id, member_label, proof_image_url, equipment_item_name, equipment_used, equipment_before, equipment_after, created_at, activity_items(item_id, item_name, quantity_added, before_quantity, after_quantity)')
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  const imageByItemId = new Map((items ?? []).map((item) => [item.id, item.image_url]));

  const enrichedActivities: ActivityRow[] = ((activities ?? []) as ActivityDbRow[]).map((activity) => ({
    id: activity.id,
    activity_type: activity.activity_type,
    member_user_id: activity.member_user_id,
    member_label: activity.member_label,
    proof_image_url: activity.proof_image_url,
    equipment_item_name: activity.equipment_item_name,
    equipment_used: activity.equipment_used,
    equipment_before: activity.equipment_before,
    equipment_after: activity.equipment_after,
    created_at: activity.created_at,
    activity_items: activity.activity_items.map((line) => ({
      item_id: line.item_id,
      item_name: line.item_name,
      quantity_added: line.quantity_added,
      before_quantity: line.before_quantity,
      after_quantity: line.after_quantity,
      item_image_url: line.item_id ? (imageByItemId.get(line.item_id) ?? null) : null
    }))
  }));

  const currentMember = members?.find((entry) => entry.id === session.userId);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Activité" subtitle="Boîte aux lettres, Cambriolage, Conteneur" />
      <ActivityTabs active="activity" canSeeStats={permissions.includes('activity.stats.view')} />
      <ActivityPageClient
        items={items ?? []}
        members={members ?? []}
        activities={canView ? enrichedActivities : []}
        defaultMemberId={session.userId}
        defaultMemberLabel={currentMember?.name || currentMember?.username || 'Groupe'}
        canCreate={permissions.includes('activity.create')}
        canViewRecent={canView}
        canEditOwn={permissions.includes('activity.edit.own')}
        canEditAny={permissions.includes('activity.edit.any')}
        canCancelOwn={permissions.includes('activity.cancel.own')}
        canCancelAny={permissions.includes('activity.cancel.any')}
        currentUserId={session.userId}
      />
    </div>
  );
}
