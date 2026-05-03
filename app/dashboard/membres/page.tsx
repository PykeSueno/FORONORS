import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MembersHubClient } from '@/components/members/members-hub-client';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, weekWindow } from '@/lib/payroll';
import { getMemberActivities, getPayrollPeriodState } from '@/lib/payroll-service';

export const dynamic = 'force-dynamic';

type MemberRow = { id: string; name: string; username: string; is_active: boolean };
type AuditRow = { id: number; action: string; summary: string; actor_name: string | null; entity_id: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };

function readPayrollConfig(value?: string | null) {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return { ...DEFAULT_PAYROLL_CONFIG, ...parsed, weights: { ...DEFAULT_PAYROLL_CONFIG.weights, ...(parsed.weights ?? {}) } };
  } catch {
    return DEFAULT_PAYROLL_CONFIG;
  }
}

export default async function MembersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const has = (permission: string) => permissions.includes(permission);
  if (!has('members.view')) redirect('/dashboard');

  const canActivities = has('members.activities.view');
  const canPayroll = has('members.payroll.view') || has('payroll.view') || has('money.pay.access');
  const canPay = has('members.payroll.pay') || has('payroll.validate') || has('money.pay.create');
  const canAdjust = has('members.payroll.adjust') || has('payroll.adjust') || has('money.pay.create');
  const canExclude = has('members.payroll.exclude') || has('payroll.adjust') || has('money.pay.create');
  const canHistory = has('members.history.view') || has('payroll.history') || has('money.pay.history.view');
  const canLogs = has('members.logs.view') || has('payroll.logs') || has('money.pay.logs.view');

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const current = payrollDisplayWindow(now);
  const previous = weekWindow(new Date(current.startIso), -1);
  const activityStart = new Date(current.startIso);
  activityStart.setUTCDate(activityStart.getUTCDate() - 70);

  const [{ data: membersData }, { data: cfgSetting }, periodState, activities] = await Promise.all([
    supabase.from('users').select('id, name, username, is_active').order('username', { ascending: true }),
    supabase.from('app_settings').select('value').eq('key', 'payroll_config').maybeSingle(),
    getPayrollPeriodState(supabase, current.startIso, current.endIso),
    canActivities || canHistory ? getMemberActivities(supabase, { startIso: activityStart.toISOString(), endIso: now.toISOString(), limit: 1500 }) : Promise.resolve([])
  ]);

  const config = readPayrollConfig(cfgSetting?.value ?? null);
  const preview = canPayroll
    ? await buildPayrollPreview(supabase, {
      weekStartIso: current.startIso,
      weekEndIso: current.endIso,
      config,
      excludedMemberIds: periodState.excluded,
      manualAdjustments: periodState.adjustments
    })
    : await buildPayrollPreview(supabase, { weekStartIso: current.startIso, weekEndIso: current.endIso, config });

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

  const payrollByMember = new Map(preview.members.map((row) => [row.memberId, row]));
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

  const memberLogActions = ['member_activity_created', 'member_payroll_paid', 'member_payroll_adjusted', 'member_payroll_excluded', 'member_payroll_reported', 'payroll_validated', 'payroll_adjusted', 'payroll_member_excluded', 'payroll.member.paid'];
  const [historyRes, logsRes] = await Promise.all([
    canHistory
      ? supabase.from('audit_logs').select('id, action, summary, actor_name, entity_id, old_values, new_values, created_at').in('action', memberLogActions).order('created_at', { ascending: false }).limit(120)
      : Promise.resolve({ data: [] }),
    canLogs
      ? supabase.from('audit_logs').select('id, action, summary, actor_name, entity_id, old_values, new_values, created_at').in('action', memberLogActions).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] })
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Membres" subtitle="Activités / Payes / Logs" />
      <MembersHubClient
        members={members}
        payrollRows={preview.members}
        activities={activities}
        history={(historyRes.data ?? []) as AuditRow[]}
        logs={(logsRes.data ?? []) as AuditRow[]}
        period={{ startIso: current.startIso, endIso: current.endIso, previousStartIso: previous.startIso, previousEndIso: previous.endIso }}
        paidMembers={periodState.paid}
        adjustments={periodState.adjustments}
        excludedMemberIds={periodState.excluded}
        reportedMembers={periodState.reported}
        canActivities={canActivities}
        canPayroll={canPayroll}
        canPay={canPay}
        canAdjust={canAdjust}
        canExclude={canExclude}
        canHistory={canHistory}
        canLogs={canLogs}
      />
    </div>
  );
}
