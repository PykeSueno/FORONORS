import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { RobberiesPageClient } from '@/components/robberies/robberies-page-client';

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
    supabase.from('items').select('id, name, quantity, image_url, category_key, type_key').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').eq('is_active', true).order('username', { ascending: true })
  ]);

  const typedRuns = (runs ?? []) as Run[];

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
      />
    </div>
  );
}
