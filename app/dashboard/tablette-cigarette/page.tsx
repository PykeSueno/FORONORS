import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TabletCigarettePageClient } from '@/components/tablet-cigarette/tablet-cigarette-page-client';
import { getTabletBusinessDate } from '@/lib/tablet';
import { ensureTabletMorningDeposit } from '@/lib/tablet-deposit';
import { CIGARETTE_ITEM_NAME, getCigaretteBusinessDate } from '@/lib/cigarette';
import { weekWindow } from '@/lib/payroll';
import { fetchJobsHistoryData } from '@/lib/jobs-history';

export default async function TabletCigarettePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canTabletAccess = permissions.includes('tablet.access');
  const canCigaretteAccess = permissions.includes('cigarette.access');
  const canProcessorView = permissions.includes('tobacco.processor.view');
  const canStoneView = permissions.includes('jobs.stone.view');
  const canTabletStats = permissions.includes('tablet.stats.view');
  const canCigaretteStats = permissions.includes('cigarette.stats.view');
  const canProcessorStats = permissions.includes('tobacco.processor.stats');
  const canProcessorLogs = permissions.includes('tobacco.processor.logs');
  const canStoneStats = permissions.includes('jobs.stone.stats.view');
  const canStoneHistory = permissions.includes('jobs.stone.history.view');
  const canJobsHistory = permissions.includes('jobs.history.view') || permissions.includes('tablet.history.view') || permissions.includes('cigarette.history.view') || canProcessorLogs || canStoneHistory;
  if (!canTabletAccess && !canCigaretteAccess && !canProcessorView && !canStoneView) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const tabletBusinessDay = getTabletBusinessDate();
  const cigaretteBusinessDay = getCigaretteBusinessDate();
  const statsWeek = weekWindow(new Date(), 0);

  if (canTabletAccess) {
    await ensureTabletMorningDeposit(supabase, { actorUserId: session.userId, onlyAfterCutoff: true });
  }

  const [membersRes, cashRes, tabletDayRes, cigaretteDayRes, kitItemRes, cutterItemRes, cigaretteItemRes, processorItemRes, stoneItemRes] = await Promise.all([
    supabase.from('users').select('id, name, username').eq('is_active', true).order('username', { ascending: true }),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    supabase.from('tablet_days').select('*').eq('business_day', tabletBusinessDay).maybeSingle(),
    supabase.from('cigarette_days').select('*').eq('business_day', cigaretteBusinessDay).maybeSingle(),
    supabase.from('items').select('name, quantity, image_url').ilike('name', '%kit%').limit(1).maybeSingle(),
    supabase.from('items').select('name, quantity, image_url').ilike('name', '%disqueuse%').limit(1).maybeSingle(),
    supabase.from('items').select('id, quantity, image_url').eq('name', CIGARETTE_ITEM_NAME).maybeSingle(),
    supabase.from('items').select('id, quantity, image_url').eq('name', 'Processeur').maybeSingle(),
    supabase.from('items').select('id, quantity, image_url').eq('name', 'Saphir Brut').maybeSingle()
  ]);

  const tabletPassages = tabletDayRes.data?.id
    ? await supabase.from('tablet_passages').select('id, member_user_id, member_label, before_cash, after_cash, before_kits, after_kits, before_cutters, after_cutters, created_at').eq('tablet_day_id', tabletDayRes.data.id).order('created_at', { ascending: false }).then((res) => res.data ?? [])
    : [];

  const cigarettePassages = permissions.includes('cigarette.history.view')
    ? await supabase.from('cigarette_passages').select('id, cigarette_day_id, business_day, member_user_id, member_label, quantity_sold, revenue_amount, before_packs, after_packs, before_deposit_packs, after_deposit_packs, before_chest, after_chest, before_group_cash, after_group_cash, status, created_at').eq('business_day', cigaretteBusinessDay).order('created_at', { ascending: false }).then((res) => res.data ?? [])
    : [];

  const processorSessions = canProcessorView
    ? await supabase.from('processor_sessions').select('*').order('created_at', { ascending: false }).limit(100).then((res) => res.data ?? [])
    : [];
  const stoneSalesToday = canStoneView
    ? await supabase.from('stone_sales').select('id, member_user_id, member_label, item_id, item_name, quantity_sold, unit_price, total_amount, stock_before, stock_after, cash_before, cash_after, created_at').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).lt('created_at', new Date(new Date(new Date().setHours(0, 0, 0, 0)).getTime() + 86400000).toISOString()).order('created_at', { ascending: false }).then((res) => res.data ?? [])
    : [];

  const jobsHistory = await fetchJobsHistoryData(supabase, {
    startIso: statsWeek.startIso,
    endIso: statsWeek.endIso,
    includeTablet: permissions.includes('jobs.history.view') || permissions.includes('tablet.history.view') || canTabletStats,
    includeCigarette: permissions.includes('cigarette.history.view') || canCigaretteStats,
    includeProcessor: canProcessorLogs || canProcessorStats,
    includeStone: canStoneHistory || canStoneStats
  });
  const currentMember = (membersRes.data ?? []).find((member) => member.id === session.userId);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Jobs" subtitle="Tablette / Cigarette / Processeur / Pierre" />
      <TabletCigarettePageClient
        members={membersRes.data ?? []}
        tabletBusinessDay={tabletBusinessDay}
        cigaretteBusinessDay={cigaretteBusinessDay}
        tabletDay={tabletDayRes.data ?? null}
        cigaretteDay={cigaretteDayRes.data ?? null}
        tabletPassages={tabletPassages}
        cigarettePassages={cigarettePassages}
        tabletStatsPassages={jobsHistory.tabletPassages}
        cigaretteStatsPassages={jobsHistory.cigarettePassages}
        groupCash={Number(cashRes.data?.balance ?? 0)}
        kitsInStock={Number(kitItemRes.data?.quantity ?? 0)}
        cuttersInStock={Number(cutterItemRes.data?.quantity ?? 0)}
        packsInStock={Number(cigaretteItemRes.data?.quantity ?? 0)}
        kitImageUrl={String(kitItemRes.data?.image_url ?? '')}
        cutterImageUrl={String(cutterItemRes.data?.image_url ?? '')}
        cigaretteImageUrl={String(cigaretteItemRes.data?.image_url ?? '')}
        processorInStock={Number(processorItemRes.data?.quantity ?? 0)}
        processorImageUrl={String(processorItemRes.data?.image_url ?? '')}
        stoneInStock={Number(stoneItemRes.data?.quantity ?? 0)}
        stoneImageUrl={String(stoneItemRes.data?.image_url ?? '')}
        stoneSales={stoneSalesToday as Parameters<typeof TabletCigarettePageClient>[0]['stoneSales']}
        stoneStatsSales={jobsHistory.stoneSales as Parameters<typeof TabletCigarettePageClient>[0]['stoneStatsSales']}
        canTabletAccess={canTabletAccess}
        canCigaretteAccess={canCigaretteAccess}
        canTabletManageDaily={permissions.includes('tablet.daily.manage')}
        canTabletCreatePassage={permissions.includes('tablet.passage.create')}
        canCigaretteCreatePassage={permissions.includes('cigarette.passage.create')}
        canCigaretteCreateForAny={permissions.includes('cigarette.passage.create.any')}
        initialHistoryRange={statsWeek}
        canHistory={canJobsHistory}
        canStats={canTabletStats || canCigaretteStats || canProcessorStats || canStoneStats}
        canProcessorView={canProcessorView}
        canProcessorCreate={permissions.includes('tobacco.processor.create') || permissions.includes('tobacco.processor.sale.validate')}
        canProcessorProduction={false}
        canProcessorSale={permissions.includes('tobacco.processor.sale') || permissions.includes('tobacco.processor.sale.view') || permissions.includes('tobacco.processor.create')}
        canProcessorStats={canProcessorStats}
        canProcessorLogs={canProcessorLogs}
        canStoneView={canStoneView}
        canStoneSell={permissions.includes('jobs.stone.sell')}
        canStoneHistory={canStoneHistory}
        canStoneStats={canStoneStats}
        processorSessions={processorSessions as Array<Record<string, unknown>>}
        processorStatsSessions={jobsHistory.processorSessions as Array<Record<string, unknown>>}
        defaultMemberId={session.userId}
        defaultMemberLabel={currentMember?.name || currentMember?.username || session.username}
      />
    </div>
  );
}
