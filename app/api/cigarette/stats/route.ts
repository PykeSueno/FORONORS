import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

function weekKey(dateIso: string) {
  const date = new Date(dateIso);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canStats] = await Promise.all([
    hasUserPermission(session.userId, 'cigarette.access'),
    hasUserPermission(session.userId, 'cigarette.stats.view')
  ]);
  if (!canAccess || !canStats) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: passages } = await supabase
    .from('cigarette_passages')
    .select('member_label, quantity_sold, revenue_amount, created_at, status, cigarette_days!inner(business_day)')
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(5000);

  const byMember: Record<string, { passages: number; packs: number; revenue: number }> = {};
  const byWeek = new Map<string, { week_start: string; passages: number; packs: number; revenue: number }>();
  const byDay = new Map<string, { day: string; passages: number; packs: number; revenue: number }>();

  for (const row of passages ?? []) {
    const businessDay = Array.isArray(row.cigarette_days) ? row.cigarette_days[0]?.business_day : row.cigarette_days?.business_day;
    if (!businessDay) continue;
    const member = row.member_label || 'Inconnu';
    if (!byMember[member]) byMember[member] = { passages: 0, packs: 0, revenue: 0 };
    byMember[member].passages += 1;
    byMember[member].packs += Number(row.quantity_sold ?? 0);
    byMember[member].revenue += Number(row.revenue_amount ?? 0);

    const week = weekKey(row.created_at);
    const weekCurrent = byWeek.get(week) ?? { week_start: week, passages: 0, packs: 0, revenue: 0 };
    weekCurrent.passages += 1;
    weekCurrent.packs += Number(row.quantity_sold ?? 0);
    weekCurrent.revenue += Number(row.revenue_amount ?? 0);
    byWeek.set(week, weekCurrent);

    const day = businessDay;
    const dayCurrent = byDay.get(day) ?? { day, passages: 0, packs: 0, revenue: 0 };
    dayCurrent.passages += 1;
    dayCurrent.packs += Number(row.quantity_sold ?? 0);
    dayCurrent.revenue += Number(row.revenue_amount ?? 0);
    byDay.set(day, dayCurrent);
  }

  const totals = Object.values(byMember).reduce((acc, entry) => ({
    passages: acc.passages + entry.passages,
    packs: acc.packs + entry.packs,
    revenue: acc.revenue + entry.revenue
  }), { passages: 0, packs: 0, revenue: 0 });

  return NextResponse.json({
    totals,
    byMember: Object.entries(byMember)
      .map(([member, values]) => ({ member, ...values }))
      .sort((a, b) => b.revenue - a.revenue || b.passages - a.passages),
    byWeek: Array.from(byWeek.values()).sort((a, b) => b.week_start.localeCompare(a.week_start)),
    byDay: Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day))
  });
}
