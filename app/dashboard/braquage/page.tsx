import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { RobberiesPageClient } from '@/components/robberies/robberies-page-client';

function weekStartIso(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString();
}

type Run = {
  id: number;
  created_at: string;
  user_name: string | null;
  robbery_type: 'fleeca' | 'bijouterie' | 'morgue';
  status?: 'success' | 'arrested';
  money_amount: number;
  lost_money?: number | null;
  money_after: number | null;
  consumed_items: Array<{ itemName: string; required: number }>;
  participants: Array<{ id?: string; label: string }>;
};

export default async function RobberyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('robberies.view')) redirect('/dashboard');

  const canCreate = permissions.includes('robberies.create');
  const canArrested = permissions.includes('robberies.arrested');
  const canStats = permissions.includes('robberies.stats');
  const canLogs = permissions.includes('robberies.logs');

  const supabase = getSupabaseAdmin();
  const [{ data: runs }, { data: items }, { data: members }] = await Promise.all([
    supabase.from('robbery_runs').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('items').select('id, name, quantity, image_url').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true })
  ]);

  const typedRuns = (runs ?? []) as Run[];
  const weekIso = weekStartIso(new Date());
  const weekRuns = typedRuns.filter((run) => run.created_at >= weekIso);

  const resources = new Map<string, number>();
  for (const run of weekRuns) {
    for (const consumed of run.consumed_items ?? []) {
      resources.set(consumed.itemName, (resources.get(consumed.itemName) ?? 0) + Number(consumed.required ?? 0));
    }
  }

  const playerMap = new Map<string, { name: string; total: number; fleeca: number; bijouterie: number; morgue: number; money: number; last: string }>();
  for (const run of weekRuns) {
    for (const participant of run.participants ?? []) {
      const key = participant.id || participant.label;
      const prev = playerMap.get(key) ?? { name: participant.label, total: 0, fleeca: 0, bijouterie: 0, morgue: 0, money: 0, last: run.created_at };
      prev.total += 1;
      prev[run.robbery_type] += 1;
      prev.money += Number(run.money_amount ?? 0);
      if (new Date(run.created_at).getTime() > new Date(prev.last).getTime()) prev.last = run.created_at;
      playerMap.set(key, prev);
    }
  }

  const playerStats = Array.from(playerMap.values())
    .map((entry) => ({ ...entry, avg: entry.total > 0 ? entry.money / entry.total : 0 }))
    .sort((a, b) => b.total - a.total || b.money - a.money);

  const stats = {
    total: weekRuns.length,
    fleeca: weekRuns.filter((run) => run.robbery_type === 'fleeca').length,
    bijouterie: weekRuns.filter((run) => run.robbery_type === 'bijouterie').length,
    morgue: weekRuns.filter((run) => run.robbery_type === 'morgue').length,
    success: weekRuns.filter((run) => (run.status ?? 'success') === 'success').length,
    arrested: weekRuns.filter((run) => (run.status ?? 'success') === 'arrested').length,
    moneyIn: weekRuns.reduce((sum, run) => sum + Number(run.money_amount ?? 0), 0),
    moneyLost: weekRuns.reduce((sum, run) => sum + Number(run.lost_money ?? 0), 0),
    resources: Array.from(resources.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8)
  };

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Braquage" subtitle="Gestion des braquages du groupe" />
      <RobberiesPageClient
        runs={typedRuns}
        items={items ?? []}
        members={(members ?? []).map((entry) => ({ id: entry.id, label: entry.name || entry.username || 'Membre' }))}
        canCreate={canCreate}
        canArrested={canArrested}
        canStats={canStats}
        canLogs={canLogs}
        stats={stats}
        playerStats={playerStats}
      />
    </div>
  );
}
