import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuditLog } from './audit-log';
import { formatUsd } from './currency';
import { syncMoneyItemToGroupCash } from './money-item';

export type MemberActivityRow = {
  id: string;
  date: string;
  memberIds: string[];
  memberLabels: string[];
  module: string;
  action: string;
  moneyGenerated: number;
  participation: number;
  details: string;
};

export type PayrollPeriodState = {
  paid: Record<string, number>;
  adjustments: Record<string, number>;
  reported: Record<string, string>;
  excluded: string[];
};

type MemberLookup = Map<string, { id: string; label: string }>;

export function payrollSettingKey(kind: 'paid' | 'adjustments' | 'reported', start: string, end: string) {
  const base = kind === 'paid' ? 'payroll_paid_members' : kind === 'adjustments' ? 'payroll_adjustments' : 'payroll_reported_members';
  return `${base}:${start}:${end}`;
}

async function readJsonSetting<T>(supabase: SupabaseClient, key: string, fallback: T) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  try { return data?.value ? JSON.parse(String(data.value)) as T : fallback; } catch { return fallback; }
}

async function writeJsonSetting(supabase: SupabaseClient, key: string, value: unknown) {
  await supabase.from('app_settings').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
}

export async function getPayrollPeriodState(supabase: SupabaseClient, start: string, end: string): Promise<PayrollPeriodState> {
  const [paid, adjustments, reported, exclusions] = await Promise.all([
    readJsonSetting<Record<string, number>>(supabase, payrollSettingKey('paid', start, end), {}),
    readJsonSetting<Record<string, number>>(supabase, payrollSettingKey('adjustments', start, end), {}),
    readJsonSetting<Record<string, string>>(supabase, payrollSettingKey('reported', start, end), {}),
    supabase.from('payroll_exclusions').select('member_user_id').eq('week_start', start).eq('week_end', end)
  ]);

  return {
    paid,
    adjustments,
    reported,
    excluded: (exclusions.data ?? []).map((row) => String(row.member_user_id))
  };
}

export async function payMemberPayroll(supabase: SupabaseClient, args: {
  actorUserId: string;
  weekStartIso: string;
  weekEndIso: string;
  memberId: string;
  memberLabel: string;
  amount: number;
}) {
  const amount = Math.max(0, Math.round(Number(args.amount ?? 0)));
  if (!args.memberId || !args.weekStartIso || !args.weekEndIso || amount <= 0) throw new Error('Paramètres invalides.');

  const paidKey = payrollSettingKey('paid', args.weekStartIso, args.weekEndIso);
  const paid = await readJsonSetting<Record<string, number>>(supabase, paidKey, {});
  if (paid[args.memberId]) throw new Error('Membre déjà payé sur cette période.');

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) throw new Error('Caisse introuvable.');

  const before = Number(cash.balance ?? 0);
  const after = before - amount;
  if (!Number.isFinite(before) || after < 0) throw new Error('Fonds insuffisants.');

  paid[args.memberId] = amount;
  await Promise.all([
    supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('cash_movements').insert({
      type: 'payroll_member_payment',
      amount: -amount,
      label: `Paye membre ${args.memberLabel} (${args.weekStartIso.slice(0, 10)})`,
      user_id: args.actorUserId,
      before_amount: before,
      after_amount: after
    }),
    writeJsonSetting(supabase, paidKey, paid)
  ]);

  await syncMoneyItemToGroupCash(supabase);
  await createAuditLog({
    actorUserId: args.actorUserId,
    action: 'member_payroll_paid',
    entityType: 'member',
    entityId: args.memberId,
    summary: `Paye membre ${args.memberLabel}: ${formatUsd(amount)}`,
    oldValues: { groupCash: before },
    newValues: { groupCash: after, start: args.weekStartIso, end: args.weekEndIso, amount, memberId: args.memberId, memberLabel: args.memberLabel }
  });

  return { paid, before, after };
}

export async function setMemberPayrollAdjustment(supabase: SupabaseClient, args: { actorUserId: string; weekStartIso: string; weekEndIso: string; memberId: string; memberLabel: string; amount: number }) {
  const key = payrollSettingKey('adjustments', args.weekStartIso, args.weekEndIso);
  const adjustments = await readJsonSetting<Record<string, number>>(supabase, key, {});
  const amount = Math.max(0, Math.round(Number(args.amount ?? 0)));
  adjustments[args.memberId] = amount;
  await writeJsonSetting(supabase, key, adjustments);
  await createAuditLog({ actorUserId: args.actorUserId, action: 'member_payroll_adjusted', entityType: 'member', entityId: args.memberId, summary: `Ajustement paye ${args.memberLabel}: ${formatUsd(amount)}`, newValues: { start: args.weekStartIso, end: args.weekEndIso, amount } });
  return adjustments;
}

export async function setMemberPayrollExcluded(supabase: SupabaseClient, args: { actorUserId: string; weekStartIso: string; weekEndIso: string; memberId: string; memberLabel: string; excluded: boolean }) {
  if (args.excluded) {
    await supabase.from('payroll_exclusions').upsert({ week_start: args.weekStartIso, week_end: args.weekEndIso, member_user_id: args.memberId, created_by: args.actorUserId }, { onConflict: 'week_start,week_end,member_user_id' });
  } else {
    await supabase.from('payroll_exclusions').delete().eq('week_start', args.weekStartIso).eq('week_end', args.weekEndIso).eq('member_user_id', args.memberId);
  }
  await createAuditLog({ actorUserId: args.actorUserId, action: 'member_payroll_excluded', entityType: 'member', entityId: args.memberId, summary: `${args.excluded ? 'Exclusion' : 'Réinclusion'} paye ${args.memberLabel}`, newValues: { start: args.weekStartIso, end: args.weekEndIso, excluded: args.excluded } });
}

export async function setMemberPayrollReported(supabase: SupabaseClient, args: { actorUserId: string; weekStartIso: string; weekEndIso: string; memberId: string; memberLabel: string; reported: boolean }) {
  const key = payrollSettingKey('reported', args.weekStartIso, args.weekEndIso);
  const reported = await readJsonSetting<Record<string, string>>(supabase, key, {});
  if (args.reported) reported[args.memberId] = new Date().toISOString();
  else delete reported[args.memberId];
  await writeJsonSetting(supabase, key, reported);
  await createAuditLog({ actorUserId: args.actorUserId, action: 'member_payroll_reported', entityType: 'member', entityId: args.memberId, summary: `${args.reported ? 'Report' : 'Annulation report'} paye ${args.memberLabel}`, newValues: { start: args.weekStartIso, end: args.weekEndIso, reported: args.reported } });
  return reported;
}

function labelFor(id: string | null | undefined, fallback: string | null | undefined, members: MemberLookup) {
  const direct = id ? members.get(id)?.label : '';
  return direct || String(fallback || id || 'Membre');
}

function normalizeParticipantIds(input: unknown, fallbackId?: string | null) {
  if (Array.isArray(input)) {
    const values = input.map((entry) => typeof entry === 'string' ? entry : entry && typeof entry === 'object' && 'id' in entry ? String((entry as { id?: unknown }).id ?? '') : '').map((entry) => entry.trim()).filter(Boolean);
    if (values.length) return Array.from(new Set(values));
  }
  return fallbackId ? [fallbackId] : [];
}

function add(rows: MemberActivityRow[], row: MemberActivityRow) {
  if (!Number.isFinite(row.moneyGenerated)) row.moneyGenerated = 0;
  if (!Number.isFinite(row.participation)) row.participation = 0;
  rows.push(row);
}

export async function getMemberActivities(supabase: SupabaseClient, args: { startIso: string; endIso: string; limit?: number }) {
  const limit = args.limit ?? 1200;
  const [{ data: members }, { data: txRows }, { data: fourRows }, { data: saleRows }, { data: drugRows }, { data: gofastRows }, { data: robberyRows }, { data: activityRows }, { data: tabletRows }, { data: cigaretteRows }, { data: processorRows }] = await Promise.all([
    supabase.from('users').select('id, name, username').limit(1000),
    supabase.from('transactions').select('id, member_user_id, actor_user_id, member_label, total_money_in, total_money_out, reason, summary, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('four_transactions').select('id, created_by, total_sales, profit_loss, status, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('sale_object_orders').select('id, created_by, total_amount, buyer_name, status, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('drug_sales').select('id, created_by, actual_amount, member_user_ids, member_labels, drug_type, status, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('gofast_runs').select('id, user_id, user_name, money_amount, participants, status, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('robbery_runs').select('id, user_id, user_name, money_amount, participants, robbery_type, status, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('activities').select('id, activity_type, member_user_id, member_label, created_by, equipment_item_name, equipment_used, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('tablet_passages').select('id, member_user_id, member_label, before_cash, after_cash, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('cigarette_passages').select('id, member_user_id, member_label, revenue_amount, status, created_at').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit),
    supabase.from('processor_sessions').select('id, participant_user_ids, validated_by, real_received, operation_type, processors_count, status, created_at').eq('status', 'validated').gte('created_at', args.startIso).lt('created_at', args.endIso).order('created_at', { ascending: false }).limit(limit)
  ]);

  const memberLookup: MemberLookup = new Map((members ?? []).map((member: { id: string; name?: string | null; username?: string | null }) => [member.id, { id: member.id, label: member.name || member.username || member.id }]));
  const rows: MemberActivityRow[] = [];
  const split = (amount: number, ids: string[]) => ids.length ? amount / ids.length : amount;

  for (const row of txRows ?? []) {
    const id = String(row.member_user_id ?? row.actor_user_id ?? '');
    const ids = id ? [id] : [];
    add(rows, { id: `tx-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((memberId) => labelFor(memberId, row.member_label, memberLookup)), module: 'Transactions', action: String(row.reason || 'Transaction'), moneyGenerated: Math.max(0, Number(row.total_money_in ?? 0) - Number(row.total_money_out ?? 0)), participation: 1, details: String(row.summary || row.reason || '') });
  }
  for (const row of fourRows ?? []) {
    const ids = row.created_by ? [String(row.created_by)] : [];
    add(rows, { id: `four-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, null, memberLookup)), module: 'FOUR', action: 'Transaction FOUR', moneyGenerated: Math.max(0, Number(row.profit_loss ?? row.total_sales ?? 0)), participation: 1, details: `Statut ${row.status ?? 'validé'}` });
  }
  for (const row of saleRows ?? []) {
    const ids = row.created_by ? [String(row.created_by)] : [];
    add(rows, { id: `sale-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, null, memberLookup)), module: 'Vente objets', action: 'Vente objet', moneyGenerated: Math.max(0, Number(row.total_amount ?? 0)), participation: 1, details: `${row.buyer_name ?? 'Acheteur'} · ${row.status ?? ''}` });
  }
  for (const row of drugRows ?? []) {
    const ids = normalizeParticipantIds(row.member_user_ids, row.created_by);
    add(rows, { id: `drug-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, null, memberLookup)), module: 'Drogues', action: `Vente ${row.drug_type ?? ''}`.trim(), moneyGenerated: Math.max(0, Number(row.actual_amount ?? 0)), participation: ids.length || 1, details: `Part par membre ${formatUsd(split(Math.max(0, Number(row.actual_amount ?? 0)), ids))}` });
  }
  for (const row of gofastRows ?? []) {
    const ids = normalizeParticipantIds(row.participants, row.user_id);
    add(rows, { id: `gofast-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, row.user_name, memberLookup)), module: 'GoFast', action: 'GoFast', moneyGenerated: Math.max(0, Number(row.money_amount ?? 0)), participation: ids.length || 1, details: `Statut ${row.status ?? 'success'}` });
  }
  for (const row of robberyRows ?? []) {
    const ids = normalizeParticipantIds(row.participants, row.user_id);
    add(rows, { id: `robbery-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, row.user_name, memberLookup)), module: 'Braquage', action: String(row.robbery_type || 'Braquage'), moneyGenerated: Math.max(0, Number(row.money_amount ?? 0)), participation: ids.length || 1, details: `Statut ${row.status ?? 'success'}` });
  }

  const activityIds = (activityRows ?? []).map((row: { id: number | string }) => Number(row.id)).filter(Boolean);
  const activityMembers = new Map<number, string[]>();
  if (activityIds.length) {
    const { data } = await supabase.from('activity_members').select('activity_id, member_user_id, member_label').in('activity_id', activityIds);
    for (const row of data ?? []) {
      const activityId = Number(row.activity_id);
      const memberId = String(row.member_user_id ?? '');
      if (!activityId || !memberId) continue;
      activityMembers.set(activityId, Array.from(new Set([...(activityMembers.get(activityId) ?? []), memberId])));
    }
  }
  for (const row of activityRows ?? []) {
    const ids = activityMembers.get(Number(row.id)) ?? normalizeParticipantIds([], row.member_user_id ?? row.created_by);
    const equipment = Number(row.equipment_used ?? 0) > 0 ? `${row.equipment_item_name ?? 'Équipement'} x${row.equipment_used}` : '';
    add(rows, { id: `activity-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, row.member_label, memberLookup)), module: 'Activités', action: String(row.activity_type || 'Activité'), moneyGenerated: 0, participation: ids.length || 1, details: equipment });
  }
  for (const row of tabletRows ?? []) {
    const ids = row.member_user_id ? [String(row.member_user_id)] : [];
    const money = Math.max(0, Number(row.after_cash ?? 0) - Number(row.before_cash ?? 0));
    add(rows, { id: `tablet-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, row.member_label, memberLookup)), module: 'Tablette', action: 'Passage tablette', moneyGenerated: money, participation: 1, details: `Cash ${formatUsd(Number(row.before_cash ?? 0))} -> ${formatUsd(Number(row.after_cash ?? 0))}` });
  }
  for (const row of cigaretteRows ?? []) {
    const ids = row.member_user_id ? [String(row.member_user_id)] : [];
    add(rows, { id: `cigarette-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, row.member_label, memberLookup)), module: 'Cigarette', action: 'Passage cigarette', moneyGenerated: Math.max(0, Number(row.revenue_amount ?? 0)), participation: 1, details: `Statut ${row.status ?? 'validé'}` });
  }
  for (const row of processorRows ?? []) {
    const ids = normalizeParticipantIds(row.participant_user_ids, row.validated_by);
    add(rows, { id: `processor-${row.id}`, date: String(row.created_at), memberIds: ids, memberLabels: ids.map((id) => labelFor(id, null, memberLookup)), module: 'Processeur', action: String(row.operation_type) === 'sale' ? 'Vente processeur' : 'Production processeur', moneyGenerated: Math.max(0, Number(row.real_received ?? 0)), participation: ids.length || 1, details: `${Number(row.processors_count ?? 0)} processeurs` });
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
