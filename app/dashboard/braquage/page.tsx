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

export default async function RobberyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('robberies.view')) redirect('/dashboard');

  const canCreate = permissions.includes('robberies.create');
  const canStats = permissions.includes('robberies.stats');
  const canLogs = permissions.includes('robberies.logs');

  const supabase = getSupabaseAdmin();
  const [{ data: runs }, { data: items }, { data: members }] = await Promise.all([
    supabase.from('robbery_runs').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('items').select('id, name, quantity, image_url').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true })
  ]);

  const weekIso = weekStartIso(new Date());
  const weekRuns = (runs ?? []).filter((run) => run.created_at >= weekIso);
  const stats = {
    count: weekRuns.length,
    fleeca: weekRuns.filter((run) => run.robbery_type === 'fleeca').length,
    bijouterie: weekRuns.filter((run) => run.robbery_type === 'bijouterie').length,
    morgue: weekRuns.filter((run) => run.robbery_type === 'morgue').length,
    moneyTotal: weekRuns.reduce((sum, run) => sum + Number(run.money_amount ?? 0), 0)
  };

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Braquage" subtitle="Gestion des braquages du groupe" />
      <RobberiesPageClient
        runs={runs ?? []}
        items={items ?? []}
        members={(members ?? []).map((entry) => ({ id: entry.id, label: entry.name || entry.username || 'Membre' }))}
        canCreate={canCreate}
        canStats={canStats}
        canLogs={canLogs}
        stats={stats}
      />
    </div>
  );
}
