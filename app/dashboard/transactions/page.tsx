import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { TransactionsTabs } from '@/components/dashboard/transactions-tabs';
import { TransactionsPageClient } from '@/components/transactions/transactions-page-client';

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('transactions.access');
  const canCreate = permissions.includes('transactions.create');
  const canManageOwn = permissions.includes('transactions.manage.own');
  const canManageAny = permissions.includes('transactions.manage.any');

  if (!canAccess) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: items }, { data: members }] = await Promise.all([
    supabase.from('items').select('id, name, image_url, buy_price, sell_price, quantity, is_money_item, category_key, type_key').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true })
  ]);

  const currentMember = members?.find((member) => member.id === session.userId);

  return (
    <>
      <InternalPageHeader title="Transactions" subtitle="Créer et exécuter des transactions multi-items" />
      <TransactionsTabs active="transactions" canSeeRecent={permissions.includes('transactions.recent.access')} />
      <TransactionsPageClient
      canCreate={canCreate}
      items={items ?? []}
      members={members ?? []}
      defaultMemberLabel={currentMember?.name || currentMember?.username || 'Groupe'}
      defaultMemberId={session.userId}
    />
    </>
  );
}
