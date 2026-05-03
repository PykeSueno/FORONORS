import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ActivityPayrollHubClient } from '@/components/activity-payroll/activity-payroll-hub-client';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, weekWindow, type PayrollConfig } from '@/lib/payroll';
import { getMemberActivities } from '@/lib/payroll-service';

export const dynamic = 'force-dynamic';

type MemberRow = { id: string; name: string; username: string; is_active: boolean };
type AuditRow = { id: number; action: string; summary: string; actor_name: string | null; entity_id: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };
type HistoryPayment = { id: number; week_start: string; week_end: string; member_user_id: string | null; member_label: string; amount: number; paid_by: string | null; group_balance_before: number; group_balance_after: number; created_at: string };

type Supabase = ReturnType<typeof getSupabaseAdmin>;

const CONFIG_KEY = 'activity_payroll_config';

function periodSettingKey(kind: 'adjustments' | 'excluded', start: string, end: string) {
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
  const [adjustments, excluded, payments] = await Promise.all([
    readJsonSetting<Record<string, number>>(supabase, periodSettingKey('adjustments', start, end), {}),
    readJsonSetting<string[]>(supabase, periodSettingKey('excluded', start, end), []),
    supabase.from('activity_payroll_payments').select('member_user_id, amount').eq('week_start', start).eq('week_end', end)
  ]);
  return {
    adjustments,
    excluded,
    paid: Object.fromEntries((payments.data ?? []).map((row) => [String(row.member_user_id), Number(row.amount ?? 0)]))
  };
}

export default async function ActivityPayrollPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const has = (permission: string) => permissions.includes(permission);
  if (!has('activity_payroll.view')) redirect('/dashboard');

  const canGlobal = has('activity_payroll.global.view');
  const canActivities = has('activity_payroll.activities.view');
  const canPayroll = has('activity_payroll.payroll.view');
  const canConfigure = has('activity_payroll.payroll.configure');
  const canPay = has('activity_payroll.payroll.pay');
  const canAdjust = has('activity_payroll.payroll.adjust');
  const canExclude = has('activity_payroll.payroll.exclude');
  const canHistory = has('activity_payroll.history.view');
  const canLogs = has('activity_payroll.logs.view');

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const current = payrollDisplayWindow(now);
  const previous = weekWindow(new Date(current.startIso), -1);
  const customStart = current.startIso;
  const customEnd = current.endIso;
  const activityStart = new Date(current.startIso);
  activityStart.setUTCDate(activityStart.getUTCDate() - 70);

  const [{ data: membersData }, { data: cfgSetting }, currentState, previousState, customState, activities, historyRes, logsRes] = await Promise.all([
    supabase.from('users').select('id, name, username, is_active').order('username', { ascending: true }),
    supabase.from('app_settings').select('value').eq('key', CONFIG_KEY).maybeSingle(),
    periodState(supabase, current.startIso, current.endIso),
    periodState(supabase, previous.startIso, previous.endIso),
    periodState(supabase, customStart, customEnd),
    canActivities || canGlobal || canHistory ? getMemberActivities(supabase, { startIso: activityStart.toISOString(), endIso: now.toISOString(), limit: 1500 }) : Promise.resolve([]),
    canHistory ? supabase.from('activity_payroll_payments').select('id, week_start, week_end, member_user_id, member_label, amount, paid_by, group_balance_before, group_balance_after, created_at').order('created_at', { ascending: false }).limit(120) : Promise.resolve({ data: [] }),
    canLogs ? supabase.from('audit_logs').select('id, action, summary, actor_name, entity_id, old_values, new_values, created_at').in('action', ['activity_payroll_config_updated', 'activity_payroll_member_paid', 'activity_payroll_member_adjusted', 'activity_payroll_member_excluded']).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] })
  ]);

  const config = readPayrollConfig(cfgSetting?.value ?? null);
  const [currentPreview, previousPreview, customPreview] = await Promise.all([
    canPayroll ? buildPayrollPreview(supabase, { weekStartIso: current.startIso, weekEndIso: current.endIso, config, excludedMemberIds: currentState.excluded, manualAdjustments: currentState.adjustments }) : buildPayrollPreview(supabase, { weekStartIso: current.startIso, weekEndIso: current.endIso, config }),
    canPayroll ? buildPayrollPreview(supabase, { weekStartIso: previous.startIso, weekEndIso: previous.endIso, config, excludedMemberIds: previousState.excluded, manualAdjustments: previousState.adjustments }) : buildPayrollPreview(supabase, { weekStartIso: previous.startIso, weekEndIso: previous.endIso, config }),
    canPayroll ? buildPayrollPreview(supabase, { weekStartIso: customStart, weekEndIso: customEnd, config, excludedMemberIds: customState.excluded, manualAdjustments: customState.adjustments, periodMode: 'custom' }) : buildPayrollPreview(supabase, { weekStartIso: customStart, weekEndIso: customEnd, config })
  ]);

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
  const members = ((membersData ?? []) as MemberRow[]).map((member) => {
    const payroll = payrollByMember.get(member.id);
    const activity = activityByMember.get(member.id);
    return {
      id: member.id,
      name: member.name || member.username,
      username: member.username,
      isActive: Boolean(member.is_active),
      moneyGenerated: Number(payroll?.moneyContribution ?? activity?.money ?? 0),
      activityCount: Number(payroll?.activityCount ?? activity?.count ?? 0),
      proposedPay: Number(payroll?.proposedPay ?? 0),
      lastActivity: activity?.last ?? null
    };
  });

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Activites & Payes" subtitle="Suivi business, activite membre et paiement" />
      <ActivityPayrollHubClient
        members={members}
        activities={activities}
        currentPreview={currentPreview}
        previousPreview={previousPreview}
        customPreview={customPreview}
        customDefaultStart={customStart}
        customDefaultEnd={customEnd}
        initialPaidMembers={currentState.paid}
        initialAdjustments={currentState.adjustments}
        initialExcludedIds={currentState.excluded}
        history={(historyRes.data ?? []) as HistoryPayment[]}
        logs={(logsRes.data ?? []) as AuditRow[]}
        canGlobal={canGlobal}
        canActivities={canActivities}
        canPayroll={canPayroll}
        canConfigure={canConfigure}
        canPay={canPay}
        canAdjust={canAdjust}
        canExclude={canExclude}
        canHistory={canHistory}
        canLogs={canLogs}
      />
    </div>
  );
}
