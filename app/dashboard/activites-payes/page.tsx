import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ActivityPayrollHubClient } from '@/components/activity-payroll/activity-payroll-hub-client';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, previousPayrollWindow, type PayrollConfig, type PayrollPreview } from '@/lib/payroll';
import { getMemberActivities } from '@/lib/payroll-service';

export const dynamic = 'force-dynamic';

type MemberRow = { id: string; name: string; username: string; is_active: boolean };
type AuditRow = { id: number; action: string; summary: string; actor_name: string | null; entity_id: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };
type HistoryPayment = { id: number; week_start: string; week_end: string; member_user_id: string | null; member_label: string; amount: number; paid_by: string | null; group_balance_before: number; group_balance_after: number; created_at: string };
type ExpenseRow = {
  id: number;
  member_id: string | null;
  member_name: string;
  label: string;
  amount: number;
  category: string;
  note: string | null;
  proof_url: string | null;
  status: 'pending' | 'reimbursed' | 'cancelled';
  created_by: string | null;
  reimbursed_by: string | null;
  reimbursed_by_name?: string | null;
  reimbursed_at: string | null;
  money_before: number | null;
  money_after: number | null;
  created_at: string;
  updated_at: string;
};

type Supabase = ReturnType<typeof getSupabaseAdmin>;

const CONFIG_KEY = 'activity_payroll_config';

function periodSettingKey(kind: 'adjustments' | 'excluded' | 'reported', start: string, end: string) {
  return `activity_payroll_${kind}:${start}:${end}`;
}

function readPayrollConfig(value?: string | null) {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return { ...DEFAULT_PAYROLL_CONFIG, ...parsed, weights: { ...DEFAULT_PAYROLL_CONFIG.weights, ...(parsed.weights ?? {}) } } as PayrollConfig;
  } catch {
    return DEFAULT_PAYROLL_CONFIG;
  }
}

async function readJsonSetting<T>(supabase: Supabase, key: string, fallback: T) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  try { return data?.value ? JSON.parse(String(data.value)) as T : fallback; } catch { return fallback; }
}

async function periodState(supabase: Supabase, start: string, end: string) {
  const [adjustments, excluded, reported, payments] = await Promise.all([
    readJsonSetting<Record<string, number>>(supabase, periodSettingKey('adjustments', start, end), {}),
    readJsonSetting<string[]>(supabase, periodSettingKey('excluded', start, end), []),
    readJsonSetting<string[]>(supabase, periodSettingKey('reported', start, end), []),
    supabase.from('activity_payroll_payments')
      .select('member_user_id, amount, created_at')
      .lt('week_start', end)
      .gt('week_end', start)
      .order('created_at', { ascending: false })
  ]);
  const paid: Record<string, number> = {};
  for (const row of payments.data ?? []) {
    const memberId = String(row.member_user_id ?? '');
    if (!memberId || paid[memberId] !== undefined) continue;
    paid[memberId] = Number(row.amount ?? 0);
  }
  return {
    adjustments,
    excluded,
    reported,
    paid
  };
}

function emptyPeriodState() {
  return { adjustments: {}, excluded: [], reported: [], paid: {} };
}

function emptyPayrollPreview(startIso: string, endIso: string, config: PayrollConfig, balance = 0): PayrollPreview {
  return {
    weekStartIso: startIso,
    weekEndIso: endIso,
    generatedAtIso: new Date().toISOString(),
    config,
    balance,
    reserveKept: config.reserveMinimum,
    fundsAvailable: 0,
    envelope: 0,
    totalProposed: 0,
    balanceAfter: balance,
    eligibleCount: 0,
    ineligibleCount: 0,
    members: [],
    periodMode: 'weekly'
  };
}

export default async function ActivityPayrollPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const has = (permission: string) => permissions.includes(permission);
  if (!has('member_ops.view')) redirect('/dashboard');

  const canSummary = has('member_ops.view');
  const canActivities = has('member_ops.activities.view');
  const canPayroll = has('member_ops.payroll.view');
  const canConfigure = has('activity_payroll.payroll.configure') || has('member_ops.payroll.adjust');
  const canPay = has('member_ops.payroll.pay');
  const canAdjust = has('member_ops.payroll.adjust');
  const canReport = has('member_ops.payroll.report') || has('member_ops.payroll.adjust');
  const canExclude = has('member_ops.payroll.exclude') || has('member_ops.payroll.adjust');
  const canExpenses = has('member_ops.expenses.view');
  const canExpenseCreate = has('member_ops.expenses.create');
  const canExpenseEdit = has('member_ops.expenses.edit') || has('expenses.edit');
  const canExpenseReimburse = has('member_ops.expenses.reimburse');
  const canExpenseCancel = has('member_ops.expenses.cancel');
  const canHistory = canSummary || has('member_ops.history.view');
  const canLogs = has('member_ops.activities.logs') || has('member_ops.payroll.logs') || has('member_ops.expenses.logs') || has('member_ops.logs.view');

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const current = payrollDisplayWindow(now);
  const previous = previousPayrollWindow(now);
  const customStart = current.startIso;
  const customEnd = current.endIso;
  const activityStart = new Date(current.startIso);
  activityStart.setUTCDate(activityStart.getUTCDate() - 70);

  const [{ data: membersData }, { data: allUsers }, { data: cfgSetting }, { data: cash }, currentState, previousState, activities, historyRes, pendingExpensesRes, reimbursedExpensesRes, statsExpensesRes, logsRes] = await Promise.all([
    supabase.from('users').select('id, name, username, is_active').eq('is_active', true).order('username', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('app_settings').select('value').eq('key', CONFIG_KEY).maybeSingle(),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle(),
    canPayroll ? periodState(supabase, current.startIso, current.endIso) : Promise.resolve(emptyPeriodState()),
    canPayroll ? periodState(supabase, previous.startIso, previous.endIso) : Promise.resolve(emptyPeriodState()),
    canActivities || canSummary || canHistory ? getMemberActivities(supabase, { startIso: activityStart.toISOString(), endIso: now.toISOString(), limit: 1500 }) : Promise.resolve([]),
    canPayroll || canHistory ? supabase.from('activity_payroll_payments').select('id, week_start, week_end, member_user_id, member_label, amount, paid_by, group_balance_before, group_balance_after, created_at').order('created_at', { ascending: false }).limit(120) : Promise.resolve({ data: [] }),
    canExpenses || canSummary || canHistory ? supabase.from('expenses').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    canExpenses || canSummary || canHistory ? supabase.from('expenses').select('*').eq('status', 'reimbursed').order('reimbursed_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    canExpenses || canSummary || canHistory ? supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
    canLogs ? supabase.from('audit_logs').select('id, action, summary, actor_name, entity_id, old_values, new_values, created_at').in('action', ['activity.create', 'activity.processor.create', 'activity.edit', 'activity.cancel', 'activity_payroll_config_updated', 'activity_payroll_member_paid', 'activity_payroll_member_adjusted', 'activity_payroll_member_excluded', 'activity_payroll_member_reported', 'expense_created', 'expense_reimbursed', 'expense_cancelled', 'expense_updated', 'member_payroll_paid', 'member_payroll_adjusted', 'member_payroll_excluded', 'member_payroll_reported']).order('created_at', { ascending: false }).limit(240) : Promise.resolve({ data: [] })
  ]);

  const config = readPayrollConfig(cfgSetting?.value ?? null);
  const cashBalance = Number(cash?.balance ?? 0);
  const [currentPreview, previousPreview] = canPayroll
    ? await Promise.all([
        buildPayrollPreview(supabase, { weekStartIso: current.startIso, weekEndIso: current.endIso, config, excludedMemberIds: currentState.excluded, manualAdjustments: currentState.adjustments }),
        buildPayrollPreview(supabase, { weekStartIso: previous.startIso, weekEndIso: previous.endIso, config, excludedMemberIds: previousState.excluded, manualAdjustments: previousState.adjustments })
      ])
    : [
        emptyPayrollPreview(current.startIso, current.endIso, config, cashBalance),
        emptyPayrollPreview(previous.startIso, previous.endIso, config, cashBalance)
      ];

  const activityByMember = new Map<string, { count: number; money: number; last: string | null }>();
  for (const activity of activities) {
    for (const memberId of activity.memberIds) {
      const currentStats = activityByMember.get(memberId) ?? { count: 0, money: 0, last: null };
      currentStats.count += 1;
      currentStats.money += Number(activity.moneyGenerated ?? 0) / Math.max(1, activity.memberIds.length);
      if (!currentStats.last || new Date(activity.date).getTime() > new Date(currentStats.last).getTime()) currentStats.last = activity.date;
      activityByMember.set(memberId, currentStats);
    }
  }

  const payrollByMember = new Map(currentPreview.members.map((row) => [row.memberId, row]));
  const expenseRows = (statsExpensesRes.data ?? [...(pendingExpensesRes.data ?? []), ...(reimbursedExpensesRes.data ?? [])]) as ExpenseRow[];
  const expenseByMember = new Map<string, { pending: number; reimbursed: number }>();
  for (const expense of expenseRows) {
    if (!expense.member_id) continue;
    const currentExpense = expenseByMember.get(expense.member_id) ?? { pending: 0, reimbursed: 0 };
    if (expense.status === 'pending') currentExpense.pending += Number(expense.amount ?? 0);
    if (expense.status === 'reimbursed') currentExpense.reimbursed += Number(expense.amount ?? 0);
    expenseByMember.set(expense.member_id, currentExpense);
  }
  const members = ((membersData ?? []) as MemberRow[]).map((member) => {
    const payroll = payrollByMember.get(member.id);
    const activity = activityByMember.get(member.id);
    const expenses = expenseByMember.get(member.id);
    return {
      id: member.id,
      name: member.name || member.username,
      username: member.username,
      isActive: Boolean(member.is_active),
      moneyGenerated: Number(payroll?.moneyContribution ?? activity?.money ?? 0),
      activityCount: Number(payroll?.activityCount ?? activity?.count ?? 0),
      proposedPay: Number(payroll?.proposedPay ?? 0),
      expensesPending: Number(expenses?.pending ?? 0),
      expensesReimbursed: Number(expenses?.reimbursed ?? 0),
      lastActivity: activity?.last ?? null
    };
  });
  const usersById = new Map((allUsers ?? []).map((user) => [user.id, user.name || user.username]));
  const withReimburser = (rows: ExpenseRow[]) => rows.map((row) => ({ ...row, reimbursed_by_name: row.reimbursed_by ? usersById.get(row.reimbursed_by) ?? row.reimbursed_by : null }));

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Activités & Payes & Dépenses" subtitle="Activités / Payes / Dépenses / Logs" />
      <ActivityPayrollHubClient
        members={members}
        activities={activities}
        currentPreview={currentPreview}
        previousPreview={previousPreview}
        customDefaultStart={customStart}
        customDefaultEnd={customEnd}
        initialPaidMembers={currentState.paid}
        initialAdjustments={currentState.adjustments}
        initialExcludedIds={currentState.excluded}
        initialReportedIds={currentState.reported}
        history={(historyRes.data ?? []) as HistoryPayment[]}
        pendingExpenses={withReimburser((pendingExpensesRes.data ?? []) as ExpenseRow[])}
        reimbursedExpenses={withReimburser((reimbursedExpensesRes.data ?? []) as ExpenseRow[])}
        expenseStatsRows={withReimburser((statsExpensesRes.data ?? []) as ExpenseRow[])}
        groupCash={Number(cash?.balance ?? currentPreview.balance ?? 0)}
        logs={(logsRes.data ?? []) as AuditRow[]}
        canSummary={canSummary}
        canActivities={canActivities}
        canPayroll={canPayroll}
        canConfigure={canConfigure}
        canPay={canPay}
        canAdjust={canAdjust}
        canReport={canReport}
        canExclude={canExclude}
        canExpenses={canExpenses}
        canExpenseCreate={canExpenseCreate}
        canExpenseEdit={canExpenseEdit}
        canExpenseReimburse={canExpenseReimburse}
        canExpenseCancel={canExpenseCancel}
        canHistory={canHistory}
        canLogs={canLogs}
      />
    </div>
  );
}
