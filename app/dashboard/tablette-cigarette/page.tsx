import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TabletCigarettePageClient } from '@/components/tablet-cigarette/tablet-cigarette-page-client';
import { getTabletBusinessDate } from '@/lib/tablet';
import { CIGARETTE_ITEM_NAME, getCigaretteBusinessDate } from '@/lib/cigarette';

export default async function TabletCigarettePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canTabletAccess = permissions.includes('tablet.access');
  const canCigaretteAccess = permissions.includes('cigarette.access');
  const canProcessorView = permissions.includes('tobacco.processor.view');
  if (!canTabletAccess && !canCigaretteAccess && !canProcessorView) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const tabletBusinessDay = getTabletBusinessDate();
  const cigaretteBusinessDay = getCigaretteBusinessDate();

  const [membersRes, cashRes, tabletDayRes, cigaretteDayRes, kitItemRes, cutterItemRes, cigaretteItemRes, processorItemRes] = await Promise.all([
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    supabase.from('tablet_days').select('*').eq('business_day', tabletBusinessDay).maybeSingle(),
    supabase.from('cigarette_days').select('*').eq('business_day', cigaretteBusinessDay).maybeSingle(),
    supabase.from('items').select('name, quantity').ilike('name', '%kit%').limit(1).maybeSingle(),
    supabase.from('items').select('name, quantity').ilike('name', '%disqueuse%').limit(1).maybeSingle(),
    supabase.from('items').select('id, quantity').eq('name', CIGARETTE_ITEM_NAME).maybeSingle(),
    supabase.from('items').select('id, quantity, image_url').eq('name', 'Processeur').maybeSingle()
  ]);

  const tabletPassages = tabletDayRes.data?.id
    ? await supabase.from('tablet_passages').select('id, member_label, before_cash, after_cash, before_kits, after_kits, before_cutters, after_cutters, created_at').eq('tablet_day_id', tabletDayRes.data.id).order('created_at', { ascending: false }).then((res) => res.data ?? [])
    : [];

  const cigarettePassages = permissions.includes('cigarette.history.view')
    ? await supabase.from('cigarette_passages').select('id, cigarette_day_id, business_day, member_label, quantity_sold, revenue_amount, before_packs, after_packs, before_deposit_packs, after_deposit_packs, before_chest, after_chest, before_group_cash, after_group_cash, status, created_at').eq('business_day', cigaretteBusinessDay).order('created_at', { ascending: false }).then((res) => res.data ?? [])
    : [];

  const processorSessions = canProcessorView
    ? await supabase.from('processor_sessions').select('*').order('created_at', { ascending: false }).limit(100).then((res) => res.data ?? [])
    : [];
  const currentMember = (membersRes.data ?? []).find((member) => member.id === session.userId);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Travail" subtitle="Tablette / Cigarette / Processeur" />
      <TabletCigarettePageClient
        members={membersRes.data ?? []}
        tabletBusinessDay={tabletBusinessDay}
        cigaretteBusinessDay={cigaretteBusinessDay}
        tabletDay={tabletDayRes.data ?? null}
        cigaretteDay={cigaretteDayRes.data ?? null}
        tabletPassages={tabletPassages}
        cigarettePassages={cigarettePassages}
        groupCash={Number(cashRes.data?.balance ?? 0)}
        kitsInStock={Number(kitItemRes.data?.quantity ?? 0)}
        cuttersInStock={Number(cutterItemRes.data?.quantity ?? 0)}
        packsInStock={Number(cigaretteItemRes.data?.quantity ?? 0)}
        processorInStock={Number(processorItemRes.data?.quantity ?? 0)}
        processorImageUrl={String(processorItemRes.data?.image_url ?? '')}
        canTabletAccess={canTabletAccess}
        canCigaretteAccess={canCigaretteAccess}
        canTabletManageDaily={permissions.includes('tablet.daily.manage')}
        canTabletCreatePassage={permissions.includes('tablet.passage.create')}
        canCigaretteCreatePassage={permissions.includes('cigarette.passage.create')}
        canCigaretteCreateForAny={permissions.includes('cigarette.passage.create.any')}
        canHistory={permissions.includes('tablet.access') || permissions.includes('cigarette.history.view')}
        canStats={permissions.includes('tablet.stats.view') || permissions.includes('cigarette.stats.view')}
        canProcessorView={canProcessorView}
        canProcessorCreate={permissions.includes('tobacco.processor.create')}
        canProcessorProduction={permissions.includes('tobacco.processor.production') || permissions.includes('tobacco.processor.create')}
        canProcessorSale={permissions.includes('tobacco.processor.sale') || permissions.includes('tobacco.processor.create')}
        canProcessorStats={permissions.includes('tobacco.processor.stats')}
        canProcessorLogs={permissions.includes('tobacco.processor.logs')}
        processorSessions={processorSessions as Array<Record<string, unknown>>}
        defaultMemberId={session.userId}
        defaultMemberLabel={currentMember?.name || currentMember?.username || session.username}
      />
    </div>
  );
}
