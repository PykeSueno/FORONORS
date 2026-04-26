import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MoneyPayPageClient } from '@/components/dashboard/money-pay-page-client';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, weekWindow } from '@/lib/payroll';

export default async function MoneyPayPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canView = permissions.includes('payroll.view') || permissions.includes('money.pay.access');
  const canPreview = permissions.includes('payroll.preview') || permissions.includes('money.pay.access');
  const canConfigure = permissions.includes('payroll.configure') || permissions.includes('money.pay.create');
  const canAdjust = permissions.includes('payroll.adjust') || permissions.includes('money.pay.create');
  const canValidate = permissions.includes('payroll.validate') || permissions.includes('money.pay.create');
  const canHistory = permissions.includes('payroll.history') || permissions.includes('money.pay.history.view');
  const canLogs = permissions.includes('payroll.logs') || permissions.includes('money.pay.logs.view');

  if (!canView || !canPreview) redirect('/dashboard/argent');

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const displayWindow = payrollDisplayWindow(now);
  const current = { startIso: displayWindow.startIso, endIso: displayWindow.endIso };
  const previous = weekWindow(new Date(displayWindow.startIso), -1);
  const customDefaultStart = '2026-04-20T00:00:00.000Z';
  const customDefaultEnd = now.toISOString();

  const [currentPreview, previousPreview, customPreview, historyRes, detailsRes, logsRes, paidRunRes, exclusionsRes] = await Promise.all([
    buildPayrollPreview(supabase, { weekStartIso: current.startIso, weekEndIso: current.endIso, config: DEFAULT_PAYROLL_CONFIG }),
    buildPayrollPreview(supabase, { weekStartIso: previous.startIso, weekEndIso: previous.endIso, config: DEFAULT_PAYROLL_CONFIG }),
    buildPayrollPreview(supabase, { weekStartIso: customDefaultStart, weekEndIso: customDefaultEnd, config: DEFAULT_PAYROLL_CONFIG, periodMode: 'custom', excludeAlreadyPaid: true }),
    canHistory
      ? supabase.from('payroll_runs').select('id, week_start, week_end, period_mode, validated_at, validated_by_label, group_balance_before, group_balance_after, reserve_kept, envelope, total_distributed').order('validated_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    canHistory
      ? supabase.from('payroll_run_members').select('id, payroll_run_id, member_user_id, member_label, amount, score_total, money_contribution, activity_count, participation_count').order('id', { ascending: false }).limit(400)
      : Promise.resolve({ data: [] }),
    canLogs
      ? supabase.from('audit_logs').select('id, action, summary, created_at, actor_name').in('action', ['payroll_validated', 'payroll_adjusted', 'payroll_member_excluded']).order('created_at', { ascending: false }).limit(80)
      : Promise.resolve({ data: [] }),
    supabase
      .from('payroll_runs')
      .select('id')
      .eq('period_mode', 'weekly')
      .eq('week_start', current.startIso)
      .eq('week_end', current.endIso)
      .order('validated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('payroll_exclusions')
      .select('member_user_id')
      .eq('week_start', current.startIso)
      .eq('week_end', current.endIso)
  ]);
  const payrollStatus = paidRunRes.data?.id
    ? 'Payée'
    : now.getUTCDay() <= 1
      ? 'À payer'
      : 'Nouvelle semaine';

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Paye 💸" subtitle={`Statut: ${payrollStatus} · Période active ${current.startIso.slice(0, 10)} → ${current.endIso.slice(0, 10)}`} />
      <MoneyPayPageClient
        canConfigure={canConfigure}
        canAdjust={canAdjust}
        canValidate={canValidate}
        canHistory={canHistory}
        canLogs={canLogs}
        currentPreview={currentPreview}
        previousPreview={previousPreview}
        customPreview={customPreview}
        customDefaultStart={customDefaultStart}
        customDefaultEnd={customDefaultEnd}
        initialExcludedIds={(exclusionsRes.data ?? []).map((row) => String(row.member_user_id))}
        history={historyRes.data ?? []}
        historyMembers={detailsRes.data ?? []}
        logs={logsRes.data ?? []}
      />
    </div>
  );
}
