import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TabletTabs } from '@/components/tablet/tablet-tabs';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

function sundayKey(date: string) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export default async function TabletStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('tablet.access') || !permissions.includes('tablet.stats.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data: passages } = await supabase.from('tablet_passages').select('member_label, created_at').order('created_at', { ascending: false }).limit(3000);

  const grouped = new Map<string, { member: string; week: string; count: number }>();
  for (const entry of passages ?? []) {
    const week = sundayKey(entry.created_at);
    const key = `${entry.member_label}-${week}`;
    const current = grouped.get(key);
    grouped.set(key, { member: entry.member_label, week, count: (current?.count ?? 0) + 1 });
  }

  const rows = Array.from(grouped.values()).sort((a, b) => b.week.localeCompare(a.week) || b.count - a.count);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats Tablette" subtitle="Statistiques hebdomadaires (dimanche → dimanche)" />
      <TabletTabs active="stats" canSeeStats />
      <section className="glass-card p-5">
        <div className="space-y-2">
          {rows.map((row, index) => (
            <article key={index} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f4d4b0]">
              <p className="font-medium">👤 {row.member}</p>
              <p className="mt-1">🗓️ Semaine du {row.week}</p>
              <p className="mt-1">🔢 Passages: {row.count}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
