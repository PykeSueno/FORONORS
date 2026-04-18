import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MoneyPayPageClient } from '@/components/dashboard/money-pay-page-client';

export default async function MoneyPayPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('money.pay.access');
  const canCreate = permissions.includes('money.pay.create');
  const canHistory = permissions.includes('money.pay.history.view');
  if (!canAccess || (!canCreate && !canHistory)) redirect('/dashboard/argent');

  const supabase = getSupabaseAdmin();
  const [{ data: members }, { data: cash }, { data: payments }] = await Promise.all([
    supabase.from('users').select('id, name, username, is_active').eq('is_active', true).order('name', { ascending: true }),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    canHistory
      ? supabase
        .from('transactions')
        .select('id, member_label, reason, total_money_out, created_at')
        .ilike('reason', 'Paye:%')
        .order('created_at', { ascending: false })
        .limit(100)
      : Promise.resolve({ data: [] })
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Paye 💸" subtitle="Payer un membre depuis la caisse groupe" />
      <MoneyPayPageClient
        canCreate={canCreate}
        canHistory={canHistory}
        balance={Number(cash?.balance ?? 0)}
        members={(members ?? []).map((member) => ({ id: member.id, label: member.name || member.username || member.id }))}
        payments={(payments ?? []).map((row) => ({
          id: row.id,
          member_label: row.member_label,
          reason: row.reason,
          amount: Number(row.total_money_out ?? 0),
          created_at: row.created_at
        }))}
      />
    </div>
  );
}
