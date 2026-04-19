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
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);
  const windowStartIso = windowStart.toISOString();
  const [{ data: members }, { data: cash }, { data: payments }, { data: activities }, { data: tabletPassages }, { data: cigarettePassages }, { data: recentTransactions }, { data: drugSales }, { data: fourTransactions }, { data: cashMovements }] = await Promise.all([
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
    ,
    supabase.from('activities').select('member_user_id, activity_members(member_user_id)').gte('created_at', windowStartIso).limit(4000),
    supabase.from('tablet_passages').select('member_user_id').not('member_user_id', 'is', null).gte('created_at', windowStartIso),
    supabase.from('cigarette_passages').select('member_user_id').not('member_user_id', 'is', null).gte('created_at', windowStartIso),
    supabase.from('transactions').select('member_user_id, reason').not('member_user_id', 'is', null).gte('created_at', windowStartIso).limit(3000),
    supabase.from('drug_sales').select('created_by').not('created_by', 'is', null).eq('status', 'validated').gte('created_at', windowStartIso).limit(3000),
    supabase.from('four_transactions').select('created_by').not('created_by', 'is', null).eq('status', 'validated').gte('created_at', windowStartIso).limit(3000),
    supabase.from('cash_movements').select('amount').gte('created_at', windowStartIso).limit(5000)
  ]);

  const memberScore = new Map<string, number>();
  const addScore = (memberId: string | null | undefined, weight: number) => {
    if (!memberId) return;
    memberScore.set(memberId, (memberScore.get(memberId) ?? 0) + weight);
  };

  for (const row of (activities ?? []) as Array<{ member_user_id: string | null; activity_members?: Array<{ member_user_id: string | null }> }>) {
    const membersFromGroup = (row.activity_members ?? []).map((entry) => entry.member_user_id).filter((memberId): memberId is string => Boolean(memberId));
    if (membersFromGroup.length > 0) {
      for (const memberId of membersFromGroup) addScore(memberId, 1.2);
    } else {
      addScore(row.member_user_id, 0.8);
    }
  }
  for (const row of tabletPassages ?? []) addScore(row.member_user_id, 1.1);
  for (const row of cigarettePassages ?? []) addScore(row.member_user_id, 0.9);
  for (const row of recentTransactions ?? []) {
    if (!row.reason?.toLowerCase().startsWith('paye:')) addScore(row.member_user_id, 0.6);
  }
  for (const row of drugSales ?? []) addScore(row.created_by, 1);
  for (const row of fourTransactions ?? []) addScore(row.created_by, 0.7);

  const maxScore = Math.max(1, ...Array.from(memberScore.values()));
  const balance = Number(cash?.balance ?? 0);
  const netFlow = Number((cashMovements ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0));
  const economyFlowFactor = netFlow >= 0 ? Math.min(1.2, 1 + (Math.abs(netFlow) / 100000)) : Math.max(0.85, 1 - (Math.abs(netFlow) / 140000));
  const liquidityFactor = balance >= 100000 ? 1.12 : balance >= 50000 ? 1 : balance >= 20000 ? 0.9 : 0.8;
  const economyIndex = Math.max(0.7, Math.min(1.25, economyFlowFactor * liquidityFactor));

  const payEstimates = Object.fromEntries(
    ((members ?? []) as Array<{ id: string }>).map((member) => {
      const activityIndex = Math.max(0.18, Math.min(1, (memberScore.get(member.id) ?? 0) / maxScore));
      const budgetBase = Math.max(300, Math.min(6000, balance * 0.02));
      const recommendedRaw = budgetBase * (0.45 + (activityIndex * 0.85)) * economyIndex;
      const recommended = Math.max(250, Math.min(Math.max(500, balance * 0.2), Math.round(recommendedRaw)));
      const minimum = Math.max(150, Math.min(recommended, Math.round(recommended * 0.75)));
      const maximum = Math.max(recommended, Math.min(Math.max(400, balance * 0.26), Math.round(recommended * 1.3)));
      return [member.id, { recommended, minimum, maximum, activityIndex: Number(activityIndex.toFixed(2)), economyIndex: Number(economyIndex.toFixed(2)) }];
    })
  );

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Paye 💸" subtitle="Payer un membre depuis la caisse groupe" />
      <MoneyPayPageClient
        canCreate={canCreate}
        canHistory={canHistory}
        balance={Number(cash?.balance ?? 0)}
        payEstimates={payEstimates}
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
