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
    supabase.from('items').select('id, name, image_url, quantity, buy_price, sell_price, category_key').order('name', { ascending: true }),
    supabase
      .from('four_sessions')
      .select('id, status, managed_by, opened_at, closed_at, summary, four_transactions(id, counterparty, status, cancel_reason, created_by, canceled_by, canceled_at, total_purchases, total_sales, profit_loss, created_at, updated_at, four_transaction_lines(id, item_id, item_name, movement_kind, quantity, unit_price, total_amount))')
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
      <InternalPageHeader title="FOUR" subtitle="Session commerciale: ouverture, transactions successives, fermeture consolidée" />
      <FourPageClient
        members={members ?? []}
        items={items ?? []}
        activeSession={active ?? null}
        history={history ?? []}
        canOpen={permissions.includes('four.open')}
        canCashAdd={permissions.includes('four.cash.add')}
        canManageTransaction={permissions.includes('four.add_movement')}
        canValidateTransaction={permissions.includes('four.transaction.validate')}
        canManageOwnTransaction={permissions.includes('four.transaction.edit.own') || permissions.includes('four.transaction.cancel.own') || permissions.includes('four.transaction.manage.own') || permissions.includes('four.transaction.manage')}
        canManageAnyTransaction={permissions.includes('four.transaction.edit.any') || permissions.includes('four.transaction.cancel.any') || permissions.includes('four.transaction.manage.any')}
        canClose={permissions.includes('four.close')}
        canViewHistory={permissions.includes('four.history.view')}
        canViewStats={permissions.includes('four.stats.view')}
        canViewMessages={permissions.includes('four.messages.view')}
        canManageMessages={permissions.includes('four.messages.manage')}
        currentUserId={session.userId}
      />
    </div>
  );
}
