import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, weekWindow, type PayrollConfig } from '@/lib/payroll';

type ValidateBody = {
  week_start_iso?: string;
  week_end_iso?: string;
  period_mode?: 'weekly' | 'custom';
  config?: Partial<PayrollConfig>;
  excluded_member_ids?: string[];
  manual_adjustments?: Record<string, number>;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canView, canPreview, canHistory, canLogs] = await Promise.all([
    hasUserPermission(session.userId, 'payroll.view'),
    hasUserPermission(session.userId, 'payroll.preview'),
    hasUserPermission(session.userId, 'payroll.history'),
    hasUserPermission(session.userId, 'payroll.logs')
  ]);

  if (!canView || !canPreview) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: cfgSetting } = await supabase.from('app_settings').select('value').eq('key', 'payroll_config').maybeSingle();
  let persistedConfig = DEFAULT_PAYROLL_CONFIG;
  try { persistedConfig = { ...DEFAULT_PAYROLL_CONFIG, ...(cfgSetting?.value ? JSON.parse(cfgSetting.value) : {}) }; } catch {}
  const url = new URL(request.url);
  const period = (url.searchParams.get('period') ?? 'current').toLowerCase();
  const customStart = url.searchParams.get('start');
  const customEnd = url.searchParams.get('end');
  const displayWindow = payrollDisplayWindow(new Date());
  const currentWindow = { startIso: displayWindow.startIso, endIso: displayWindow.endIso };
  const previousWindow = weekWindow(new Date(displayWindow.startIso), -1);
  const selectedWindow = period === 'custom' && customStart && customEnd
    ? { startIso: new Date(customStart).toISOString(), endIso: new Date(customEnd).toISOString(), mode: 'custom' as const }
    : period === 'previous'
      ? { ...previousWindow, mode: 'weekly' as const }
      : { ...currentWindow, mode: 'weekly' as const };
  const exclusionFetch = (startIso: string, endIso: string) => supabase
    .from('payroll_exclusions')
    .select('member_user_id')
    .eq('week_start', startIso)
    .eq('week_end', endIso);

  const [currentExcludedRes, previousExcludedRes, selectedExcludedRes, historyRes, logsRes] = await Promise.all([
    exclusionFetch(currentWindow.startIso, currentWindow.endIso),
    exclusionFetch(previousWindow.startIso, previousWindow.endIso),
    exclusionFetch(selectedWindow.startIso, selectedWindow.endIso),
    canHistory
      ? supabase.from('payroll_runs').select('id, week_start, week_end, period_mode, validated_at, validated_by_label, group_balance_before, group_balance_after, reserve_kept, envelope, total_distributed, config_snapshot, excluded_members, manual_adjustments').order('validated_at', { ascending: false }).limit(40)
      : Promise.resolve({ data: [] }),
    canLogs
      ? supabase.from('audit_logs').select('id, action, summary, created_at, actor_name').in('action', ['payroll_validated', 'payroll_preview', 'payroll_adjusted', 'payroll_member_excluded']).order('created_at', { ascending: false }).limit(80)
      : Promise.resolve({ data: [] })
  ]);
  const [current, previous, selected] = await Promise.all([
    buildPayrollPreview(supabase, { weekStartIso: currentWindow.startIso, weekEndIso: currentWindow.endIso, config: persistedConfig, periodMode: 'weekly', excludedMemberIds: (currentExcludedRes.data ?? []).map((row) => String(row.member_user_id)) }),
    buildPayrollPreview(supabase, { weekStartIso: previousWindow.startIso, weekEndIso: previousWindow.endIso, config: persistedConfig, periodMode: 'weekly', excludedMemberIds: (previousExcludedRes.data ?? []).map((row) => String(row.member_user_id)) }),
    buildPayrollPreview(supabase, { weekStartIso: selectedWindow.startIso, weekEndIso: selectedWindow.endIso, config: persistedConfig, periodMode: selectedWindow.mode, excludeAlreadyPaid: selectedWindow.mode === 'custom', excludedMemberIds: (selectedExcludedRes.data ?? []).map((row) => String(row.member_user_id)) })
  ]);
  const paidKey = `payroll_paid_members:${selectedWindow.startIso}:${selectedWindow.endIso}`;
  const { data: paidSetting } = await supabase.from('app_settings').select('value').eq('key', paidKey).maybeSingle();
  let paidMembers: Record<string, number> = {};
  try { paidMembers = paidSetting?.value ? JSON.parse(paidSetting.value) as Record<string, number> : {}; } catch {}

  return NextResponse.json({
    current,
    previous,
    selected,
    history: historyRes.data ?? [],
    logs: logsRes.data ?? [],
    paidMembers
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canView, canPreview, canConfigure, canAdjust, canValidate] = await Promise.all([
    hasUserPermission(session.userId, 'payroll.view'),
    hasUserPermission(session.userId, 'payroll.preview'),
    hasUserPermission(session.userId, 'payroll.configure'),
    hasUserPermission(session.userId, 'payroll.adjust'),
    hasUserPermission(session.userId, 'payroll.validate')
  ]);

  if (!canView || !canPreview || !canValidate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as ValidateBody;
  const now = new Date();
  const periodMode = body.period_mode === 'custom' ? 'custom' : 'weekly';
  const weekStartIso = body.week_start_iso ?? weekWindow(now, 0).startIso;
  const weekEndIso = body.week_end_iso ?? (() => {
    const d = new Date(weekStartIso);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
  })();

  const config = canConfigure ? body.config : undefined;
  const excludedMemberIds = (body.excluded_member_ids ?? []).filter(Boolean);
  const manualAdjustments = canAdjust ? (body.manual_adjustments ?? {}) : {};

  const supabase = getSupabaseAdmin();
  const [{ data: existing }, preview] = await Promise.all([
    supabase.from('payroll_runs').select('id, week_start, week_end').lt('week_start', weekEndIso).gt('week_end', weekStartIso).order('validated_at', { ascending: false }).limit(10),
    buildPayrollPreview(supabase, { weekStartIso, weekEndIso, config, excludedMemberIds, manualAdjustments, excludeAlreadyPaid: periodMode === 'custom', periodMode })
  ]);

  const overlaps = (existing ?? []).filter((run) => weekStartIso < String(run.week_end) && weekEndIso > String(run.week_start));
  if (overlaps.length > 0 && !canConfigure) return NextResponse.json({ message: 'Une paye existe déjà sur une période qui se chevauche.' }, { status: 409 });
  if (preview.totalProposed <= 0) return NextResponse.json({ message: 'Aucune paye calculée à valider.' }, { status: 400 });
  if (preview.totalProposed > preview.envelope) return NextResponse.json({ message: 'Le total dépasse l’enveloppe disponible.' }, { status: 400 });
  if (preview.balanceAfter < 0) return NextResponse.json({ message: 'Fonds insuffisants.' }, { status: 400 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const balanceBefore = Number(cash.balance ?? 0);
  const balanceAfter = balanceBefore - preview.totalProposed;
  if (balanceAfter < 0) return NextResponse.json({ message: 'Solde groupe insuffisant.' }, { status: 400 });

  const { data: actor } = await supabase.from('users').select('name, username').eq('id', session.userId).maybeSingle();
  const actorLabel = actor?.name || actor?.username || session.username || 'Système';

  const paidMembers = preview.members.filter((entry) => entry.eligible && entry.proposedPay > 0);
  const { data: createdRun, error: runError } = await supabase
    .from('payroll_runs')
    .insert({
      week_start: weekStartIso,
      week_end: weekEndIso,
      period_mode: periodMode,
      validated_at: new Date().toISOString(),
      validated_by: session.userId,
      validated_by_label: actorLabel,
      group_balance_before: balanceBefore,
      group_balance_after: balanceAfter,
      reserve_kept: preview.reserveKept,
      envelope: preview.envelope,
      total_distributed: preview.totalProposed,
      config_snapshot: preview.config,
      excluded_members: excludedMemberIds,
      manual_adjustments: manualAdjustments
    })
    .select('id')
    .maybeSingle();

  if (runError || !createdRun) return NextResponse.json({ message: 'Validation paye impossible.' }, { status: 400 });

  await Promise.all([
    supabase.from('group_cash').update({ balance: balanceAfter, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('cash_movements').insert({
      type: 'payment',
      amount: -preview.totalProposed,
      label: `Paye hebdomadaire ${weekStartIso.slice(0, 10)} → ${weekEndIso.slice(0, 10)}`,
      user_id: session.userId,
      before_amount: balanceBefore,
      after_amount: balanceAfter
    }),
    paidMembers.length > 0
      ? supabase.from('payroll_run_members').insert(paidMembers.map((entry) => ({
        payroll_run_id: createdRun.id,
        member_user_id: entry.memberId,
        member_label: entry.memberLabel,
        amount: entry.proposedPay,
        score_total: entry.totalScore,
        score_money: entry.moneyScore,
        score_activity: entry.activityScore,
        score_participation: entry.participationScore,
        money_contribution: entry.moneyContribution,
        activity_count: entry.activityCount,
        participation_count: entry.participationCount,
        detail_snapshot: entry
      })))
      : Promise.resolve(),
    paidMembers.length > 0
      ? supabase.from('transactions').insert(paidMembers.map((entry) => ({
        actor_user_id: session.userId,
        member_user_id: entry.memberId,
        member_label: entry.memberLabel,
        reason: `Paye Semaine ${weekStartIso.slice(0, 10)}`,
        total_money_in: 0,
        total_money_out: entry.proposedPay,
        stock_in_count: 0,
        stock_out_count: 0,
        profit_loss: -entry.proposedPay,
        summary: `Paye hebdo ${entry.memberLabel}`
      })))
      : Promise.resolve()
  ]);

  await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'payroll_validated',
    entityType: 'payroll_run',
    entityId: createdRun.id,
    summary: `Paye validée (${weekStartIso.slice(0, 10)} → ${weekEndIso.slice(0, 10)}) · ${paidMembers.length} membres · ${preview.totalProposed}$`,
    oldValues: { balance: balanceBefore },
    newValues: {
      balance: balanceAfter,
      weekStartIso,
      weekEndIso,
      periodMode,
      reserveKept: preview.reserveKept,
      envelope: preview.envelope,
      totalDistributed: preview.totalProposed,
      excludedMemberIds,
      manualAdjustments,
      paidMembers: paidMembers.map((entry) => ({ id: entry.memberId, label: entry.memberLabel, amount: entry.proposedPay }))
    }
  });

  for (const memberId of excludedMemberIds) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'payroll_member_excluded',
      entityType: 'payroll_run',
      entityId: createdRun.id,
      summary: `Membre exclu de la paye: ${memberId}`,
      newValues: { memberId, weekStartIso }
    });
  }

  for (const [memberId, amount] of Object.entries(manualAdjustments)) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'payroll_adjusted',
      entityType: 'payroll_run',
      entityId: createdRun.id,
      summary: `Ajustement manuel paye: ${memberId} => ${amount}`,
      newValues: { memberId, amount, weekStartIso }
    });
  }

  return NextResponse.json({ ok: true, payrollRunId: createdRun.id });
}


export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canView, canConfigure] = await Promise.all([hasUserPermission(session.userId, 'payroll.view'), hasUserPermission(session.userId, 'payroll.configure')]);
  if (!canView || !canConfigure) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const body = await request.json() as { config?: Partial<PayrollConfig> };
  const source = { ...DEFAULT_PAYROLL_CONFIG, ...(body.config ?? {}), weights: { ...DEFAULT_PAYROLL_CONFIG.weights, ...(body.config?.weights ?? {}) } };
  const num = (value: unknown, fallback: number, min = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
  };
  const next: PayrollConfig = {
    reserveMinimum: num(source.reserveMinimum, DEFAULT_PAYROLL_CONFIG.reserveMinimum),
    distributablePercent: Math.min(1, num(source.distributablePercent, DEFAULT_PAYROLL_CONFIG.distributablePercent)),
    memberCap: num(source.memberCap, DEFAULT_PAYROLL_CONFIG.memberCap),
    memberMinimum: num(source.memberMinimum, DEFAULT_PAYROLL_CONFIG.memberMinimum),
    minActions: Math.round(num(source.minActions, DEFAULT_PAYROLL_CONFIG.minActions)),
    minMoney: num(source.minMoney, DEFAULT_PAYROLL_CONFIG.minMoney),
    weights: {
      money: num(source.weights.money, DEFAULT_PAYROLL_CONFIG.weights.money),
      activity: num(source.weights.activity, DEFAULT_PAYROLL_CONFIG.weights.activity),
      participation: num(source.weights.participation, DEFAULT_PAYROLL_CONFIG.weights.participation)
    }
  };
  const supabase = getSupabaseAdmin();
  await supabase.from('app_settings').upsert({ key: 'payroll_config', value: JSON.stringify(next), updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, config: next });
}
