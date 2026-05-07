import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, weekWindow } from '@/lib/payroll';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('member_ops.view') && !permissions.includes('activity_payroll.view')) {
    return NextResponse.json({ currentEstimate: 0, previousEstimate: 0 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const displayWindow = payrollDisplayWindow(now);
  const previousWeek = weekWindow(new Date(displayWindow.startIso), -1);
  const [currentPreview, previousPreview, activeCustomRun] = await Promise.all([
    buildPayrollPreview(supabase, { weekStartIso: displayWindow.startIso, weekEndIso: displayWindow.endIso, config: DEFAULT_PAYROLL_CONFIG }),
    buildPayrollPreview(supabase, { weekStartIso: previousWeek.startIso, weekEndIso: previousWeek.endIso, config: DEFAULT_PAYROLL_CONFIG }),
    supabase
      .from('payroll_runs')
      .select('id')
      .eq('period_mode', 'custom')
      .lte('week_start', displayWindow.startIso)
      .gt('week_end', displayWindow.startIso)
      .order('validated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const currentMember = currentPreview.members.find((entry) => entry.memberId === session.userId);
  const previousMember = previousPreview.members.find((entry) => entry.memberId === session.userId);
  if (activeCustomRun.data?.id) {
    const { data: customMember } = await supabase
      .from('payroll_run_members')
      .select('amount')
      .eq('payroll_run_id', activeCustomRun.data.id)
      .eq('member_user_id', session.userId)
      .maybeSingle();
    return NextResponse.json({
      currentEstimate: Number.isFinite(Number(customMember?.amount)) ? Number(customMember?.amount ?? 0) : 0,
      previousEstimate: Number.isFinite(Number(previousMember?.proposedPay)) ? Number(previousMember?.proposedPay ?? 0) : 0
    });
  }

  return NextResponse.json({
    currentEstimate: Number.isFinite(Number(currentMember?.proposedPay)) ? Number(currentMember?.proposedPay ?? 0) : 0,
    previousEstimate: Number.isFinite(Number(previousMember?.proposedPay)) ? Number(previousMember?.proposedPay ?? 0) : 0
  });
}
