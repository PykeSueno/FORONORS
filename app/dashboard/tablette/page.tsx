import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TabletTabs } from '@/components/tablet/tablet-tabs';
import { TabletPageClient } from '@/components/tablet/tablet-page-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletBusinessDate } from '@/lib/tablet';

export default async function TabletPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('tablet.access')) redirect('/dashboard');

  const businessDay = getTabletBusinessDate();
  const supabase = getSupabaseAdmin();
  const [{ data: day }, { data: members }, { data: passages }] = await Promise.all([
    supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle(),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('tablet_passages').select('id, member_label, before_cash, after_cash, before_kits, after_kits, before_cutters, after_cutters, created_at').eq('tablet_day_id', -1).limit(0)
  ]);

  const dayId = day?.id;
  const dayPassages = dayId
    ? (await supabase
        .from('tablet_passages')
        .select('id, member_label, before_cash, after_cash, before_kits, after_kits, before_cutters, after_cutters, created_at')
        .eq('tablet_day_id', dayId)
        .order('created_at', { ascending: false })).data ?? []
    : passages ?? [];

  const currentMember = members?.find((member) => member.id === session.userId);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Tablette" subtitle="Gestion des passages 8h → 8h" />
      <TabletTabs active="tablet" />
      <TabletPageClient
        day={day ?? null}
        businessDay={businessDay}
        members={members ?? []}
        passages={dayPassages}
        canManageDaily={permissions.includes('tablet.daily.manage')}
        canCreatePassage={permissions.includes('tablet.passage.create')}
        defaultMemberId={session.userId}
        defaultMemberLabel={currentMember?.name || currentMember?.username || 'Groupe'}
      />
    </div>
  );
}
