import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MoneyPageClient } from '@/components/dashboard/money-page-client';

export default async function MoneyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('money.access')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: cash }, { data: movements }] = await Promise.all([
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    supabase.from('cash_movements').select('id, type, amount, label, created_at').order('created_at', { ascending: false }).limit(25)
  ]);

  return (
    <>
      <InternalPageHeader title="Argent" subtitle="Suivi de la caisse du groupe" />
      <MoneyPageClient
      canEdit={permissions.includes('money.edit')}
      initialBalance={Number(cash?.balance ?? 0)}
      initialMovements={movements ?? []}
    />
    </>
  );
}
