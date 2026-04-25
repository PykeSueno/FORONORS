import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MoneyPayPageClient } from '@/components/dashboard/money-pay-page-client';
import { sortMembersByGrade } from '@/lib/members';

export default async function MoneyPayPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('money.pay.access');
  const canCreate = permissions.includes('money.pay.create');
  const canHistory = permissions.includes('money.pay.history.view');
  if (!canAccess || (!canCreate && !canHistory)) redirect('/dashboard/argent');

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(weekStart);

  const windowStartIso = previousWeekStart.toISOString();
  const weekStartIso = weekStart.toISOString();
  const previousWeekEndIso = previousWeekEnd.toISOString();
  const [{ data: members }, { data: cash }, { data: payments }, { data: activities }, { data: tabletPassages }, { data: cigarettePassages }, { data: recentTransactions }, { data: drugSales }, { data: fourTransactions }, { data: cashMovements }] = await Promise.all([
    supabase.from('users').select('id, name, username, is_active, roles(name)').eq('is_active', true),
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
    supabase.from('activities').select('member_user_id, created_at, activity_members(member_user_id)').gte('created_at', windowStartIso).limit(4000),
    supabase.from('tablet_passages').select('member_user_id, created_at').not('member_user_id', 'is', null).gte('created_at', windowStartIso),
    supabase.from('cigarette_passages').select('member_user_id, created_at').not('member_user_id', 'is', null).gte('created_at', windowStartIso),
    supabase.from('transactions').select('member_user_id, reason, created_at').not('member_user_id', 'is', null).gte('created_at', windowStartIso).limit(3000),
    supabase.from('drug_sales').select('created_by, created_at').not('created_by', 'is', null).eq('status', 'validated').gte('created_at', windowStartIso).limit(3000),
    supabase.from('four_transactions').select('created_by, created_at').not('created_by', 'is', null).eq('status', 'validated').gte('created_at', windowStartIso).limit(3000),
    supabase.from('cash_movements').select('amount').gte('created_at', windowStartIso).limit(5000)
  ]);

  const currentWeekScore = new Map<string, number>();
  const previousWeekScore = new Map<string, number>();
  const addScore = (memberId: string | null | undefined, weight: number) => {
    if (!memberId) return;
    currentWeekScore.set(memberId, (currentWeekScore.get(memberId) ?? 0) + weight);
  };
  const addPreviousScore = (memberId: string | null | undefined, weight: number) => {
    if (!memberId) return;
    previousWeekScore.set(memberId, (previousWeekScore.get(memberId) ?? 0) + weight);
  };
  const isCurrentWeek = (createdAt: string | null | undefined) => Boolean(createdAt && createdAt >= weekStartIso);
  const isPreviousWeek = (createdAt: string | null | undefined) => Boolean(createdAt && createdAt >= windowStartIso && createdAt < previousWeekEndIso);
  const weightedAdd = (createdAt: string | null | undefined, memberId: string | null | undefined, weight: number) => {
    if (isCurrentWeek(createdAt)) addScore(memberId, weight);
    else if (isPreviousWeek(createdAt)) addPreviousScore(memberId, weight);
  };

  for (const row of (activities ?? []) as Array<{ member_user_id: string | null; created_at?: string; activity_members?: Array<{ member_user_id: string | null }> }>) {
    const membersFromGroup = (row.activity_members ?? []).map((entry) => entry.member_user_id).filter((memberId): memberId is string => Boolean(memberId));
    if (membersFromGroup.length > 0) {
      for (const memberId of membersFromGroup) weightedAdd(row.created_at, memberId, 1.2);
    } else {
      weightedAdd(row.created_at, row.member_user_id, 0.8);
    }
  }
  for (const row of tabletPassages ?? []) weightedAdd(row.created_at, row.member_user_id, 1.1);
  for (const row of cigarettePassages ?? []) weightedAdd(row.created_at, row.member_user_id, 0.9);
  for (const row of recentTransactions ?? []) {
    if (!row.reason?.toLowerCase().startsWith('paye:')) weightedAdd(row.created_at, row.member_user_id, 0.6);
  }
  for (const row of drugSales ?? []) weightedAdd(row.created_at, row.created_by, 1);
  for (const row of fourTransactions ?? []) weightedAdd(row.created_at, row.created_by, 0.7);

  const maxCurrentScore = Math.max(1, ...Array.from(currentWeekScore.values()));
  const maxPreviousScore = Math.max(1, ...Array.from(previousWeekScore.values()));
  const balance = Number(cash?.balance ?? 0);
  const netFlow = Number((cashMovements ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0));
  const economyFlowFactor = netFlow >= 0 ? Math.min(1.2, 1 + (Math.abs(netFlow) / 100000)) : Math.max(0.85, 1 - (Math.abs(netFlow) / 140000));
  const liquidityFactor = balance >= 100000 ? 1.12 : balance >= 50000 ? 1 : balance >= 20000 ? 0.9 : 0.8;
  const economyIndex = Math.max(0.7, Math.min(1.25, economyFlowFactor * liquidityFactor));

  const payEstimates = Object.fromEntries(
    sortMembersByGrade(((members ?? []) as Array<{ id: string; name?: string; username?: string; roles?: { name?: string | null } | { name?: string | null }[] | null }>).map((member) => ({
      ...member,
      role_name: Array.isArray(member.roles) ? member.roles[0]?.name ?? '' : member.roles?.name ?? ''
    }))).map((member) => {
      const activityIndex = Math.max(0.12, Math.min(1, (currentWeekScore.get(member.id) ?? 0) / maxCurrentScore));
      const previousActivityIndex = Math.max(0.12, Math.min(1, (previousWeekScore.get(member.id) ?? 0) / maxPreviousScore));
      const budgetBase = Math.max(300, Math.min(6000, balance * 0.02));
      const recommendedRaw = budgetBase * (0.45 + (activityIndex * 0.85)) * economyIndex;
      const recommended = Math.max(250, Math.min(Math.max(500, balance * 0.2), Math.round(recommendedRaw)));
      const previousRecommended = Math.max(250, Math.min(Math.max(500, balance * 0.2), Math.round(budgetBase * (0.45 + (previousActivityIndex * 0.85)) * economyIndex)));
      const minimum = Math.max(150, Math.min(recommended, Math.round(recommended * 0.75)));
      const maximum = Math.max(recommended, Math.min(Math.max(400, balance * 0.26), Math.round(recommended * 1.3)));
      return [member.id, { recommended, previousRecommended, minimum, maximum, activityIndex: Number(activityIndex.toFixed(2)), economyIndex: Number(economyIndex.toFixed(2)) }];
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
        members={sortMembersByGrade(((members ?? []) as Array<{ id: string; name?: string; username?: string; roles?: { name?: string | null } | { name?: string | null }[] | null }>).map((member) => ({
          ...member,
          role_name: Array.isArray(member.roles) ? member.roles[0]?.name ?? '' : member.roles?.name ?? ''
        }))).map((member) => ({ id: member.id, label: member.name || member.username || member.id }))}
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
