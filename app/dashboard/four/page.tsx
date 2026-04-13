import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourPageClient } from '@/components/four/four-page-client';

export default async function FourPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: members }, { data: items }, { data: active }, { data: history }] = await Promise.all([
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('items').select('id, name, image_url, quantity').order('name', { ascending: true }),
    supabase
      .from('four_sessions')
      .select('id, status, managed_by, opened_at, closed_at, summary, four_movements(id, movement_kind, item_id, item_name, quantity, unit_price, total_amount, note, created_at)')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    permissions.includes('four.history.view')
      ? supabase.from('four_sessions').select('id, status, opened_at, closed_at, summary').eq('status', 'closed').order('closed_at', { ascending: false }).limit(25)
      : Promise.resolve({ data: [] })
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="FOUR" subtitle="Session active de vente/achat consolidée à la clôture" />
      <FourPageClient
        members={members ?? []}
        items={items ?? []}
        activeSession={active ?? null}
        history={history ?? []}
        canOpen={permissions.includes('four.open')}
        canManage={permissions.includes('four.manage')}
        canClose={permissions.includes('four.close')}
        canViewHistory={permissions.includes('four.history.view')}
        currentUserId={session.userId}
      />
    </div>
  );
}
