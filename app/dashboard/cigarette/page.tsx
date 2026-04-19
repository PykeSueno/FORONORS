import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { CigaretteTabs } from '@/components/cigarette/cigarette-tabs';
import { CigarettePageClient } from '@/components/cigarette/cigarette-page-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CIGARETTE_ITEM_NAME, getCigaretteBusinessDate } from '@/lib/cigarette';

export default async function CigarettePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('cigarette.access')) redirect('/dashboard');
  const canHistoryView = permissions.includes('cigarette.history.view');

  const businessDay = getCigaretteBusinessDate();
  const supabase = getSupabaseAdmin();
  const [{ data: day }, { data: members }, { data: cash }, { data: cigaretteItem }] = await Promise.all([
    supabase.from('cigarette_days').select('*').eq('business_day', businessDay).maybeSingle(),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    supabase.from('items').select('id, quantity').eq('name', CIGARETTE_ITEM_NAME).maybeSingle()
  ]);

  const { data: passages } = day?.id && canHistoryView
    ? await supabase
        .from('cigarette_passages')
        .select('id, member_label, quantity_sold, revenue_amount, before_packs, after_packs, before_deposit_packs, after_deposit_packs, before_chest, after_chest, before_group_cash, after_group_cash, status, created_at')
        .eq('cigarette_day_id', day.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const currentMember = members?.find((member) => member.id === session.userId);
  const defaultMemberId = currentMember?.id ?? session.userId;
  const defaultMemberLabel = currentMember?.name || currentMember?.username || session.username;

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Cigarette" subtitle="Passages 4h → 20h · 62 paquets · 992$" />
      <CigaretteTabs active="cigarette" canSeeStats={permissions.includes('cigarette.stats.view')} />
      <CigarettePageClient
        day={day ?? null}
        businessDay={businessDay}
        members={members ?? []}
        passages={passages ?? []}
        groupCash={Number(cash?.balance ?? 0)}
        packsInStock={Number(cigaretteItem?.quantity ?? 0)}
        canCreatePassage={permissions.includes('cigarette.passage.create')}
        canCreateForAny={permissions.includes('cigarette.passage.create.any')}
        canManageDaily={permissions.includes('cigarette.daily.manage')}
        canHistoryView={canHistoryView}
        defaultMemberId={defaultMemberId}
        defaultMemberLabel={defaultMemberLabel}
      />
    </div>
  );
}
