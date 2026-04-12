import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { TransactionsPageClient } from '@/components/transactions/transactions-page-client';

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('transactions.access');
  const canView = permissions.includes('transactions.view');
  const canCreate = permissions.includes('transactions.create');

  if (!canAccess || !canView) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: items }, { data: members }, { data: transactions }] = await Promise.all([
    supabase.from('items').select('id, name, image_url, buy_price, sell_price, quantity, is_money_item').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, reason, member_label, total_money_in, total_money_out, profit_loss, created_at, transaction_lines(item_name_snapshot, quantity, movement_type)')
      .order('created_at', { ascending: false })
      .limit(30)
  ]);

  const currentMember = members?.find((member) => member.id === session.userId);

  return (
    <TransactionsPageClient
      canCreate={canCreate}
      items={items ?? []}
      members={members ?? []}
      transactions={transactions ?? []}
      defaultMemberLabel={currentMember?.name || currentMember?.username || 'Groupe'}
      defaultMemberId={session.userId}
    />
  );
}
