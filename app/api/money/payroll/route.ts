import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, weekWindow, type PayrollConfig } from '@/lib/payroll';

type ValidateBody = {
  week_start_iso?: string;
  config?: Partial<PayrollConfig>;
  excluded_member_ids?: string[];
  manual_adjustments?: Record<string, number>;
};

export async function GET() {
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
  const currentWindow = weekWindow(new Date(), 0);
  const previousWindow = weekWindow(new Date(), -1);

  const [current, previous, historyRes, logsRes] = await Promise.all([
    buildPayrollPreview(supabase, { weekStartIso: currentWindow.startIso, weekEndIso: currentWindow.endIso, config: DEFAULT_PAYROLL_CONFIG }),
    buildPayrollPreview(supabase, { weekStartIso: previousWindow.startIso, weekEndIso: previousWindow.endIso, config: DEFAULT_PAYROLL_CONFIG }),
    canHistory
      ? supabase.from('payroll_runs').select('id, week_start, week_end, validated_at, validated_by_label, group_balance_before, group_balance_after, reserve_kept, envelope, total_distributed, config_snapshot, excluded_members, manual_adjustments').order('validated_at', { ascending: false }).limit(40)
      : Promise.resolve({ data: [] }),
    canLogs
      ? supabase.from('audit_logs').select('id, action, summary, created_at, actor_name').in('action', ['payroll_validated', 'payroll_preview', 'payroll_adjusted', 'payroll_member_excluded']).order('created_at', { ascending: false }).limit(80)
      : Promise.resolve({ data: [] })
  ]);

  return NextResponse.json({
    current,
    previous,
    history: historyRes.data ?? [],
    logs: logsRes.data ?? []
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
  const weekStartIso = body.week_start_iso ?? weekWindow(now, 0).startIso;
  const weekEndIso = (() => {
    const d = new Date(weekStartIso);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
  })();

  const config = canConfigure ? body.config : undefined;
  const excludedMemberIds = (body.excluded_member_ids ?? []).filter(Boolean);
  const manualAdjustments = canAdjust ? (body.manual_adjustments ?? {}) : {};

  const supabase = getSupabaseAdmin();
  const [{ data: existing }, preview] = await Promise.all([
    supabase.from('payroll_runs').select('id').eq('week_start', weekStartIso).limit(1).maybeSingle(),
    buildPayrollPreview(supabase, { weekStartIso, weekEndIso, config, excludedMemberIds, manualAdjustments })
  ]);

  if (existing?.id) return NextResponse.json({ message: 'Une paye existe déjà pour cette semaine.' }, { status: 409 });
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
