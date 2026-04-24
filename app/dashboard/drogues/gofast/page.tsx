import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { GoFastPageClient } from '@/components/drugs/gofast-page-client';

function weekStartIso(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString();
}

export default async function DrugsGoFastPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('drugs.gofast.view')) redirect('/dashboard/drogues');

  const canCreate = permissions.includes('drugs.gofast.create');
  const canArrested = permissions.includes('drugs.gofast.arrested');
  const canStats = permissions.includes('drugs.gofast.stats');
  const canLogs = permissions.includes('drugs.gofast.logs');

  const supabase = getSupabaseAdmin();
  const [{ data: items }, { data: runs }] = await Promise.all([
    supabase.from('items').select('id, name, image_url, quantity, category_key, type_key').eq('category_key', 'drugs').eq('type_key', 'bag').order('name', { ascending: true }),
    supabase.from('gofast_runs').select('*').order('created_at', { ascending: false }).limit(250)
  ]);

  const filteredItems = (items ?? []).filter((item) => {
    const name = String(item.name ?? '').toLowerCase();
    return !name.includes('graine') && !name.includes('table');
  });

  const since = weekStartIso(new Date());
  const weekRuns = (runs ?? []).filter((run) => run.created_at >= since);
  const stats = {
    successCount: weekRuns.filter((run) => run.status === 'success').length,
    arrestedCount: weekRuns.filter((run) => run.status === 'arrested').length,
    sentQty: weekRuns.reduce((sum, run) => sum + Number(run.status === 'success' ? run.quantity : 0), 0),
    seizedQty: weekRuns.reduce((sum, run) => sum + Number(run.seized_quantity ?? 0), 0),
    moneyIn: weekRuns.reduce((sum, run) => sum + Number(run.money_amount ?? 0), 0),
    moneyLost: weekRuns.reduce((sum, run) => sum + Number(run.lost_money ?? 0), 0)
  };

  return (
    <div className="space-y-5">
      <InternalPageHeader title="GoFast" subtitle="Livraison de pochons — suivi stock / argent / incidents" />
      <GoFastPageClient
        items={filteredItems}
        runs={runs ?? []}
        stats={stats}
        canCreate={canCreate}
        canArrested={canArrested}
        canStats={canStats}
        canLogs={canLogs}
      />
    </div>
  );
}
