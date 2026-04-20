import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { CigaretteTabs } from '@/components/cigarette/cigarette-tabs';
import { CigaretteStatsClient } from '@/components/cigarette/cigarette-stats-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCigaretteBusinessDate } from '@/lib/cigarette';

export default async function CigaretteStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('cigarette.access') || !permissions.includes('cigarette.stats.view')) {
    redirect('/dashboard/cigarette');
  }

  const supabase = getSupabaseAdmin();
  const { data: passages } = await supabase
    .from('cigarette_passages')
    .select('member_label, quantity_sold, revenue_amount, created_at, business_day, status')
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(5000);
  const currentBusinessDay = getCigaretteBusinessDate();

  const byMember = new Map<string, { member: string; passages: number; packs: number; revenue: number }>();
  const byWeek = new Map<string, { week_start: string; passages: number; packs: number; revenue: number }>();
  const byDay = new Map<string, { day: string; passages: number; packs: number; revenue: number }>();

  for (const passage of passages ?? []) {
    const member = passage.member_label || 'Inconnu';
    const memberCurrent = byMember.get(member) ?? { member, passages: 0, packs: 0, revenue: 0 };
    memberCurrent.passages += 1;
    memberCurrent.packs += Number(passage.quantity_sold ?? 0);
    memberCurrent.revenue += Number(passage.revenue_amount ?? 0);
    byMember.set(member, memberCurrent);

    const created = new Date(passage.created_at);
    const week = new Date(created);
    week.setDate(week.getDate() - week.getDay());
    const weekKey = week.toISOString().slice(0, 10);
    const weekCurrent = byWeek.get(weekKey) ?? { week_start: weekKey, passages: 0, packs: 0, revenue: 0 };
    weekCurrent.passages += 1;
    weekCurrent.packs += Number(passage.quantity_sold ?? 0);
    weekCurrent.revenue += Number(passage.revenue_amount ?? 0);
    byWeek.set(weekKey, weekCurrent);

    const dayKey = passage.business_day || passage.created_at.slice(0, 10);
    const dayCurrent = byDay.get(dayKey) ?? { day: dayKey, passages: 0, packs: 0, revenue: 0 };
    dayCurrent.passages += 1;
    dayCurrent.packs += Number(passage.quantity_sold ?? 0);
    dayCurrent.revenue += Number(passage.revenue_amount ?? 0);
    byDay.set(dayKey, dayCurrent);
  }

  const totals = Array.from(byMember.values()).reduce((acc, row) => ({
    passages: acc.passages + row.passages,
    packs: acc.packs + row.packs,
    revenue: acc.revenue + row.revenue
  }), { passages: 0, packs: 0, revenue: 0 });

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats Cigarette" subtitle="Classement membres et tendances" />
      <CigaretteTabs active="stats" canSeeStats />
      <CigaretteStatsClient
        totals={totals}
        byMember={Array.from(byMember.values()).sort((a, b) => b.revenue - a.revenue || b.passages - a.passages)}
        byWeek={Array.from(byWeek.values()).sort((a, b) => b.week_start.localeCompare(a.week_start))}
        byDay={Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day))}
        currentBusinessDay={currentBusinessDay}
      />
    </div>
  );
}
