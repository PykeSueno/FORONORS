import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { buildPayrollPreview, DEFAULT_PAYROLL_CONFIG, payrollDisplayWindow, previousPayrollWindow, type PayrollConfig } from '@/lib/payroll';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { getSupabaseAdmin } from '@/lib/supabase';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';

type Action = 'pay' | 'adjust' | 'exclude' | 'report';
type Body = {
  action?: Action;
  week_start_iso?: string;
  week_end_iso?: string;
  member_id?: string;
  member_label?: string;
  amount?: number;
  enabled?: boolean;
};
type ConfigBody = { config?: Partial<PayrollConfig> };

type Supabase = ReturnType<typeof getSupabaseAdmin>;

const CONFIG_KEY = 'activity_payroll_config';

function periodSettingKey(kind: 'adjustments' | 'excluded' | 'reported', start: string, end: string) {
  return `activity_payroll_${kind}:${start}:${end}`;
}

async function canAny(userId: string, permissions: string[]) {
  const results = await Promise.all(permissions.map((permission) => hasUserPermission(userId, permission)));
  return results.some(Boolean);
}

async function readJsonSetting<T>(supabase: Supabase, key: string, fallback: T) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  try { return data?.value ? JSON.parse(String(data.value)) as T : fallback; } catch { return fallback; }
}

async function writeJsonSetting(supabase: Supabase, key: string, value: unknown) {
  await supabase.from('app_settings').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
}

function normalizeConfig(source?: Partial<PayrollConfig>): PayrollConfig {
  const merged = { ...DEFAULT_PAYROLL_CONFIG, ...(source ?? {}), weights: { ...DEFAULT_PAYROLL_CONFIG.weights, ...(source?.weights ?? {}) } };
  const num = (value: unknown, fallback: number, min = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
  };
  return {
    reserveMinimum: num(merged.reserveMinimum, DEFAULT_PAYROLL_CONFIG.reserveMinimum),
    distributablePercent: Math.min(1, num(merged.distributablePercent, DEFAULT_PAYROLL_CONFIG.distributablePercent)),
    memberCap: num(merged.memberCap, DEFAULT_PAYROLL_CONFIG.memberCap),
    memberMinimum: num(merged.memberMinimum, DEFAULT_PAYROLL_CONFIG.memberMinimum),
    minActions: Math.round(num(merged.minActions, DEFAULT_PAYROLL_CONFIG.minActions)),
    minMoney: num(merged.minMoney, DEFAULT_PAYROLL_CONFIG.minMoney),
    weights: {
      money: num(merged.weights.money, DEFAULT_PAYROLL_CONFIG.weights.money),
      activity: num(merged.weights.activity, DEFAULT_PAYROLL_CONFIG.weights.activity),
      participation: num(merged.weights.participation, DEFAULT_PAYROLL_CONFIG.weights.participation)
    }
  };
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
  return { adjustments, excluded, reported, paid };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canAny(session.userId, ['member_ops.payroll.view', 'activity_payroll.payroll.view'])) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const period = (url.searchParams.get('period') ?? 'current').toLowerCase();
  const customStart = url.searchParams.get('start');
  const customEnd = url.searchParams.get('end');
  const display = payrollDisplayWindow(new Date());
  const currentWindow = { startIso: display.startIso, endIso: display.endIso, mode: 'weekly' as const };
  const previousWindow = { ...previousPayrollWindow(new Date()), mode: 'weekly' as const };
  const selectedWindow = period === 'custom' && customStart && customEnd
    ? { startIso: new Date(customStart).toISOString(), endIso: new Date(customEnd).toISOString(), mode: 'custom' as const }
    : period === 'previous'
      ? previousWindow
      : currentWindow;

  const config = normalizeConfig(await readJsonSetting<Partial<PayrollConfig>>(supabase, CONFIG_KEY, DEFAULT_PAYROLL_CONFIG));
  const [currentState, previousState, selectedState, historyRes, logsRes] = await Promise.all([
    periodState(supabase, currentWindow.startIso, currentWindow.endIso),
    periodState(supabase, previousWindow.startIso, previousWindow.endIso),
    periodState(supabase, selectedWindow.startIso, selectedWindow.endIso),
    supabase.from('activity_payroll_payments').select('id, week_start, week_end, member_user_id, member_label, amount, paid_by, group_balance_before, group_balance_after, created_at').order('created_at', { ascending: false }).limit(120),
    supabase.from('audit_logs').select('id, action, summary, actor_name, entity_id, old_values, new_values, created_at').in('action', ['activity.create', 'activity.processor.create', 'activity.edit', 'activity.cancel', 'activity_payroll_config_updated', 'activity_payroll_member_paid', 'activity_payroll_member_adjusted', 'activity_payroll_member_excluded', 'activity_payroll_member_reported', 'expense_created', 'expense_reimbursed', 'expense_cancelled', 'expense_updated', 'member_payroll_paid', 'member_payroll_adjusted', 'member_payroll_excluded', 'member_payroll_reported']).order('created_at', { ascending: false }).limit(160)
  ]);

  const [current, previous, selected] = await Promise.all([
    buildPayrollPreview(supabase, { weekStartIso: currentWindow.startIso, weekEndIso: currentWindow.endIso, config, excludedMemberIds: currentState.excluded, manualAdjustments: currentState.adjustments }),
    buildPayrollPreview(supabase, { weekStartIso: previousWindow.startIso, weekEndIso: previousWindow.endIso, config, excludedMemberIds: previousState.excluded, manualAdjustments: previousState.adjustments }),
    buildPayrollPreview(supabase, { weekStartIso: selectedWindow.startIso, weekEndIso: selectedWindow.endIso, config, excludedMemberIds: selectedState.excluded, manualAdjustments: selectedState.adjustments, periodMode: selectedWindow.mode })
  ]);

  return NextResponse.json({ current, previous, selected, state: selectedState, history: historyRes.data ?? [], logs: logsRes.data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const body = await request.json() as Body;
  const action = body.action ?? 'pay';
  const weekStartIso = String(body.week_start_iso ?? '');
  const weekEndIso = String(body.week_end_iso ?? '');
  const memberId = String(body.member_id ?? '');
  const memberLabel = String(body.member_label ?? 'Membre');
  if (!weekStartIso || !weekEndIso || !memberId) return NextResponse.json({ message: 'Paramètres invalides.' }, { status: 400 });

  const allowed = action === 'pay'
    ? await canAny(session.userId, ['member_ops.payroll.pay', 'activity_payroll.payroll.pay'])
    : action === 'adjust'
      ? await canAny(session.userId, ['member_ops.payroll.adjust', 'activity_payroll.payroll.adjust'])
      : action === 'exclude'
        ? await canAny(session.userId, ['member_ops.payroll.exclude', 'activity_payroll.payroll.exclude', 'member_ops.payroll.adjust', 'activity_payroll.payroll.adjust'])
        : await canAny(session.userId, ['member_ops.payroll.report', 'member_ops.payroll.adjust', 'activity_payroll.payroll.adjust']);
  if (!allowed) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'activity_payroll', action, memberIds: [memberId] });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
  if (action === 'adjust') {
    const key = periodSettingKey('adjustments', weekStartIso, weekEndIso);
    const adjustments = await readJsonSetting<Record<string, number>>(supabase, key, {});
    const amount = Math.max(0, Math.round(Number(body.amount ?? 0)));
    adjustments[memberId] = amount;
    await writeJsonSetting(supabase, key, adjustments);
    await createAuditLog({ actorUserId: session.userId, action: 'activity_payroll_member_adjusted', entityType: 'activity_payroll', entityId: memberId, summary: `Ajustement paye ${memberLabel}: ${amount}$`, newValues: { weekStartIso, weekEndIso, memberId, memberLabel, amount } });
    return NextResponse.json({ ok: true, adjustments });
  }

  if (action === 'exclude') {
    const key = periodSettingKey('excluded', weekStartIso, weekEndIso);
    const excluded = await readJsonSetting<string[]>(supabase, key, []);
    const next = body.enabled === false ? excluded.filter((id) => id !== memberId) : Array.from(new Set([...excluded, memberId]));
    await writeJsonSetting(supabase, key, next);
    await createAuditLog({ actorUserId: session.userId, action: 'activity_payroll_member_excluded', entityType: 'activity_payroll', entityId: memberId, summary: `${body.enabled === false ? 'Réinclusion' : 'Exclusion'} paye ${memberLabel}`, newValues: { weekStartIso, weekEndIso, memberId, memberLabel, excluded: body.enabled !== false } });
    return NextResponse.json({ ok: true, excluded: next });
  }

  if (action === 'report') {
    const key = periodSettingKey('reported', weekStartIso, weekEndIso);
    const reported = await readJsonSetting<string[]>(supabase, key, []);
    const next = body.enabled === false ? reported.filter((id) => id !== memberId) : Array.from(new Set([...reported, memberId]));
    await writeJsonSetting(supabase, key, next);
    await createAuditLog({ actorUserId: session.userId, action: 'activity_payroll_member_reported', entityType: 'activity_payroll', entityId: memberId, summary: `${body.enabled === false ? 'Reprise' : 'Report'} paye ${memberLabel}`, newValues: { weekStartIso, weekEndIso, memberId, memberLabel, reported: body.enabled !== false } });
    return NextResponse.json({ ok: true, reported: next });
  }

  const amount = Math.max(0, Math.round(Number(body.amount ?? 0)));
  if (amount <= 0) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });
  const { data: existing } = await supabase.from('activity_payroll_payments')
    .select('id')
    .eq('member_user_id', memberId)
    .lt('week_start', weekEndIso)
    .gt('week_end', weekStartIso)
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ message: 'Membre déjà payé sur cette période.' }, { status: 409 });
  const flags = await periodState(supabase, weekStartIso, weekEndIso);
  if (flags.excluded.includes(memberId)) return NextResponse.json({ message: 'Membre exclu de la paye sur cette période.' }, { status: 409 });
  if (flags.reported.includes(memberId)) return NextResponse.json({ message: 'Paye reportée pour ce membre sur cette période.' }, { status: 409 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const before = Number(cash.balance ?? 0);
  const after = before - amount;
  if (!Number.isFinite(before) || after < 0) return NextResponse.json({ message: 'Fonds insuffisants.' }, { status: 400 });

  await Promise.all([
    supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('cash_movements').insert({ type: 'exit', amount: -amount, label: `Paye membre — ${memberLabel}`, user_id: session.userId, before_amount: before, after_amount: after }),
    supabase.from('activity_payroll_payments').insert({ week_start: weekStartIso, week_end: weekEndIso, member_user_id: memberId, member_label: memberLabel, amount, paid_by: session.userId, group_balance_before: before, group_balance_after: after })
  ]);
  await syncMoneyItemToGroupCash(supabase);
  await createAuditLog({ actorUserId: session.userId, action: 'activity_payroll_member_paid', entityType: 'activity_payroll', entityId: memberId, summary: `Paye Activités & Payes ${memberLabel}: ${amount}$`, oldValues: { groupCash: before }, newValues: { groupCash: after, weekStartIso, weekEndIso, memberId, memberLabel, amount } });
  const state = await periodState(supabase, weekStartIso, weekEndIso);
  return NextResponse.json({ ok: true, paid: state.paid, after });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canAny(session.userId, ['activity_payroll.payroll.configure', 'member_ops.payroll.adjust'])) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = await request.json() as ConfigBody;
  const config = normalizeConfig(body.config);
  const supabase = getSupabaseAdmin();
  await writeJsonSetting(supabase, CONFIG_KEY, config);
  await createAuditLog({ actorUserId: session.userId, action: 'activity_payroll_config_updated', entityType: 'activity_payroll', summary: 'Réglages Activités & Payes mis à jour', newValues: { config } });
  return NextResponse.json({ ok: true, config });
}
