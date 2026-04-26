import type { SupabaseClient } from '@supabase/supabase-js';

export type PayrollConfig = {
  reserveMinimum: number;
  distributablePercent: number;
  memberCap: number;
  memberMinimum: number;
  minActions: number;
  minMoney: number;
  weights: { money: number; activity: number; participation: number };
};

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  reserveMinimum: 40000,
  distributablePercent: 0.3,
  memberCap: 12000,
  memberMinimum: 500,
  minActions: 2,
  minMoney: 500,
  weights: { money: 0.6, activity: 0.25, participation: 0.15 }
};

export type PayrollMemberRow = {
  memberId: string;
  memberLabel: string;
  isActive: boolean;
  moneyContribution: number;
  activityCount: number;
  participationCount: number;
  moneyScore: number;
  activityScore: number;
  participationScore: number;
  totalScore: number;
  proposedPay: number;
  eligible: boolean;
  reason: string;
};

export type PayrollPreview = {
  weekStartIso: string;
  weekEndIso: string;
  generatedAtIso: string;
  config: PayrollConfig;
  balance: number;
  reserveKept: number;
  fundsAvailable: number;
  envelope: number;
  totalProposed: number;
  balanceAfter: number;
  eligibleCount: number;
  ineligibleCount: number;
  members: PayrollMemberRow[];
  periodMode?: 'weekly' | 'custom';
};

function normalizeLabel(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function weekWindow(now: Date, shiftWeeks = 0) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - day + (shiftWeeks * 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function splitAmount(amount: number, participants: string[]) {
  if (participants.length === 0) return [] as Array<{ memberId: string; value: number }>;
  const share = amount / participants.length;
  return participants.map((memberId) => ({ memberId, value: share }));
}

function normalizeParticipantIds(input: unknown, fallback?: string | null) {
  if (Array.isArray(input)) {
    const ids = input
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && 'id' in entry && typeof (entry as { id?: unknown }).id === 'string') return (entry as { id: string }).id;
        return '';
      })
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (ids.length > 0) return Array.from(new Set(ids));
  }
  return fallback ? [fallback] : [];
}

function distributePool(pool: number, eligibleRows: PayrollMemberRow[], cfg: PayrollConfig) {
  if (pool <= 0 || eligibleRows.length === 0) return;
  const totalScore = eligibleRows.reduce((sum, row) => sum + row.totalScore, 0);
  if (totalScore <= 0) return;

  for (const row of eligibleRows) {
    const proportional = pool * (row.totalScore / totalScore);
    row.proposedPay = Math.min(cfg.memberCap, Math.max(cfg.memberMinimum, roundMoney(proportional)));
  }

  let currentTotal = eligibleRows.reduce((sum, row) => sum + row.proposedPay, 0);
  if (currentTotal > pool) {
    const scale = pool / currentTotal;
    for (const row of eligibleRows) {
      row.proposedPay = Math.min(cfg.memberCap, roundMoney(row.proposedPay * scale));
    }
    currentTotal = eligibleRows.reduce((sum, row) => sum + row.proposedPay, 0);
  }

  if (currentTotal > pool) {
    const sorted = [...eligibleRows].sort((a, b) => b.proposedPay - a.proposedPay);
    let overflow = currentTotal - pool;
    for (const row of sorted) {
      if (overflow <= 0) break;
      const reducible = Math.max(0, row.proposedPay - cfg.memberMinimum);
      const cut = Math.min(reducible, overflow);
      row.proposedPay -= cut;
      overflow -= cut;
    }
  }
}

export async function buildPayrollPreview(supabase: SupabaseClient, args: {
  weekStartIso: string;
  weekEndIso: string;
  config?: Partial<PayrollConfig>;
  excludedMemberIds?: string[];
  manualAdjustments?: Record<string, number>;
  excludeAlreadyPaid?: boolean;
  ignorePayrollRunId?: number | null;
  periodMode?: 'weekly' | 'custom';
}) {
  const cfg: PayrollConfig = {
    ...DEFAULT_PAYROLL_CONFIG,
    ...(args.config ?? {}),
    weights: { ...DEFAULT_PAYROLL_CONFIG.weights, ...(args.config?.weights ?? {}) }
  };

  const excluded = new Set((args.excludedMemberIds ?? []).filter(Boolean));
  const manualAdjustments = args.manualAdjustments ?? {};
  const skipAlreadyPaid = Boolean(args.excludeAlreadyPaid);

  const paidRanges: Array<{ start: string; end: string }> = [];
  if (skipAlreadyPaid) {
    const { data: paidRuns } = await supabase
      .from('payroll_runs')
      .select('id, week_start, week_end')
      .lt('week_start', args.weekEndIso)
      .gt('week_end', args.weekStartIso)
      .order('validated_at', { ascending: false })
      .limit(120);
    for (const run of paidRuns ?? []) {
      if (args.ignorePayrollRunId && Number(run.id) === Number(args.ignorePayrollRunId)) continue;
      paidRanges.push({ start: String(run.week_start), end: String(run.week_end) });
    }
  }
  const isAlreadyPaid = (createdAt?: string | null) => {
    if (!createdAt || paidRanges.length === 0) return false;
    return paidRanges.some((range) => createdAt >= range.start && createdAt < range.end);
  };

  const [
    { data: members },
    { data: cash },
    { data: txRows },
    { data: fourRows },
    { data: saleRows },
    { data: drugRows },
    { data: gofastRows },
    { data: robberyRows },
    { data: activityRows },
    { data: tabletRows },
    { data: cigaretteRows }
  ] = await Promise.all([
    supabase.from('users').select('id, name, username, is_active').order('username', { ascending: true }),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle(),
    supabase.from('transactions').select('member_user_id, actor_user_id, member_label, total_money_in, total_money_out, created_at').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(5000),
    supabase.from('four_transactions').select('created_by, profit_loss, created_at, status').eq('status', 'validated').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(3000),
    supabase.from('sale_object_orders').select('created_by, total_amount, created_at, status').in('status', ['pending_receipt', 'received']).gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(3000),
    supabase.from('drug_sales').select('created_by, actual_amount, member_user_ids, created_at, status').eq('status', 'validated').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(5000),
    supabase.from('gofast_runs').select('user_id, user_name, money_amount, participants, created_at, status').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(3000),
    supabase.from('robbery_runs').select('user_id, user_name, money_amount, participants, created_at, status').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(3000),
    supabase.from('activities').select('id, member_user_id, member_label, created_by, created_at').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(5000),
    supabase.from('tablet_passages').select('member_user_id, member_label, before_cash, after_cash, created_at').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(5000),
    supabase.from('cigarette_passages').select('member_user_id, member_label, revenue_amount, created_at').gte('created_at', args.weekStartIso).lt('created_at', args.weekEndIso).limit(5000)
  ]);

  const memberIdByLabel = new Map<string, string>();
  for (const member of members ?? []) {
    const id = member.id as string;
    const keys = [normalizeLabel(member.name as string | null), normalizeLabel(member.username as string | null)];
    for (const key of keys) if (key) memberIdByLabel.set(key, id);
  }
  const resolveMemberId = (candidate?: string | null, fallbackLabel?: string | null) => {
    const direct = (candidate ?? '').trim();
    if (direct) return direct;
    const fallback = normalizeLabel(fallbackLabel);
    return fallback ? (memberIdByLabel.get(fallback) ?? null) : null;
  };

  const moneyByMember = new Map<string, number>();
  const activityByMember = new Map<string, number>();
  const participationByMember = new Map<string, number>();

  const addMoney = (memberId: string | null | undefined, amount: number) => {
    if (!memberId || !Number.isFinite(amount) || amount <= 0) return;
    moneyByMember.set(memberId, (moneyByMember.get(memberId) ?? 0) + amount);
  };
  const addActivity = (memberId: string | null | undefined, amount = 1) => {
    if (!memberId) return;
    activityByMember.set(memberId, (activityByMember.get(memberId) ?? 0) + amount);
  };
  const addParticipation = (memberId: string | null | undefined, amount = 1) => {
    if (!memberId) return;
    participationByMember.set(memberId, (participationByMember.get(memberId) ?? 0) + amount);
  };

  for (const row of txRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const inAmount = Number(row.total_money_in ?? 0);
    const outAmount = Number(row.total_money_out ?? 0);
    const contribution = Math.max(0, inAmount - outAmount);
    const memberId = resolveMemberId(row.member_user_id ?? row.actor_user_id, row.member_label);
    addMoney(memberId, contribution);
    addActivity(memberId, 1);
  }

  for (const row of fourRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const profit = Math.max(0, Number(row.profit_loss ?? 0));
    const memberId = resolveMemberId(row.created_by, null);
    addMoney(memberId, profit);
    addActivity(memberId, 1);
  }

  for (const row of saleRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const memberId = resolveMemberId(row.created_by, null);
    addMoney(memberId, Math.max(0, Number(row.total_amount ?? 0)));
    addActivity(memberId, 1);
  }

  for (const row of drugRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const amount = Math.max(0, Number(row.actual_amount ?? 0));
    const participants = normalizeParticipantIds(row.member_user_ids, resolveMemberId(row.created_by, null));
    const split = splitAmount(amount, participants);
    if (split.length === 0) addMoney(resolveMemberId(row.created_by, null), amount);
    for (const entry of split) addMoney(entry.memberId, entry.value);
    for (const memberId of (participants.length > 0 ? participants : [resolveMemberId(row.created_by, null)]).filter(Boolean) as string[]) {
      addActivity(memberId, 1);
      addParticipation(memberId, 1);
    }
  }

  for (const row of gofastRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const amount = Math.max(0, Number(row.money_amount ?? 0));
    const participants = normalizeParticipantIds(row.participants, resolveMemberId(row.user_id, row.user_name));
    const split = splitAmount(amount, participants);
    if (split.length === 0) addMoney(resolveMemberId(row.user_id, row.user_name), amount);
    for (const entry of split) addMoney(entry.memberId, entry.value);
    for (const memberId of (participants.length > 0 ? participants : [resolveMemberId(row.user_id, row.user_name)]).filter(Boolean) as string[]) {
      addActivity(memberId, 1);
      addParticipation(memberId, 1.5);
    }
  }

  for (const row of robberyRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const amount = Math.max(0, Number(row.money_amount ?? 0));
    const participants = normalizeParticipantIds(row.participants, resolveMemberId(row.user_id, row.user_name));
    const split = splitAmount(amount, participants);
    if (split.length === 0) addMoney(resolveMemberId(row.user_id, row.user_name), amount);
    for (const entry of split) addMoney(entry.memberId, entry.value);
    for (const memberId of (participants.length > 0 ? participants : [resolveMemberId(row.user_id, row.user_name)]).filter(Boolean) as string[]) {
      addActivity(memberId, 1);
      addParticipation(memberId, 1.5);
    }
  }

  const activityIds = (activityRows ?? []).map((row: { id: number | string }) => Number(row.id)).filter((value: number) => Number.isFinite(value) && value > 0);
  const activityMembersByActivityId = new Map<number, string[]>();
  if (activityIds.length > 0) {
    const { data: activityMemberRows } = await supabase.from('activity_members').select('activity_id, member_user_id, member_label').in('activity_id', activityIds);
    for (const row of activityMemberRows ?? []) {
      const activityId = Number(row.activity_id ?? 0);
      const memberId = resolveMemberId(row.member_user_id, row.member_label);
      if (!activityId || !memberId) continue;
      const ids = activityMembersByActivityId.get(activityId) ?? [];
      ids.push(memberId);
      activityMembersByActivityId.set(activityId, Array.from(new Set(ids)));
    }
  }
  for (const row of activityRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const fallbackMemberId = resolveMemberId(row.member_user_id ?? row.created_by, row.member_label);
    const ids = activityMembersByActivityId.get(Number(row.id)) ?? (fallbackMemberId ? [fallbackMemberId] : []);
    for (const memberId of ids) {
      addActivity(memberId, 1);
      addParticipation(memberId, 0.7);
    }
  }

  for (const row of tabletRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const delta = Math.max(0, Number(row.after_cash ?? 0) - Number(row.before_cash ?? 0));
    const memberId = resolveMemberId(row.member_user_id, row.member_label);
    addMoney(memberId, delta);
    addActivity(memberId, 1);
  }

  for (const row of cigaretteRows ?? []) {
    if (isAlreadyPaid(row.created_at)) continue;
    const memberId = resolveMemberId(row.member_user_id, row.member_label);
    addMoney(memberId, Math.max(0, Number(row.revenue_amount ?? 0)));
    addActivity(memberId, 1);
  }

  const maxMoney = Math.max(1, ...Array.from(moneyByMember.values()));
  const maxActivity = Math.max(1, ...Array.from(activityByMember.values()));
  const maxParticipation = Math.max(1, ...Array.from(participationByMember.values()));

  const rows: PayrollMemberRow[] = (members ?? []).map((member: { id: string; name?: string | null; username?: string | null; is_active?: boolean | null }) => {
    const memberId = member.id as string;
    const moneyContribution = Number(moneyByMember.get(memberId) ?? 0);
    const activityCount = Number(activityByMember.get(memberId) ?? 0);
    const participationCount = Number(participationByMember.get(memberId) ?? 0);
    const moneyScore = moneyContribution / maxMoney;
    const activityScore = activityCount / maxActivity;
    const participationScore = participationCount / maxParticipation;

    const active = Boolean(member.is_active ?? true);
    const hasEligibilitySignal = activityCount >= cfg.minActions || moneyContribution >= cfg.minMoney;
    const isExcluded = excluded.has(memberId);
    const eligible = active && hasEligibilitySignal && !isExcluded;

    let reason = 'Éligible';
    if (!active) reason = 'Membre désactivé';
    else if (isExcluded) reason = 'Exclu manuellement';
    else if (activityCount < cfg.minActions && moneyContribution < cfg.minMoney) reason = 'Aucune activité suffisante cette semaine';

    return {
      memberId,
      memberLabel: (member.name as string | null) || (member.username as string | null) || memberId,
      isActive: active,
      moneyContribution,
      activityCount,
      participationCount,
      moneyScore,
      activityScore,
      participationScore,
      totalScore: eligible
        ? (moneyScore * cfg.weights.money) + (activityScore * cfg.weights.activity) + (participationScore * cfg.weights.participation)
        : 0,
      proposedPay: 0,
      eligible,
      reason
    };
  });

  const balance = Number(cash?.balance ?? 0);
  const reserveKept = Math.max(0, cfg.reserveMinimum);
  const fundsAvailable = Math.max(0, balance - reserveKept);
  const envelope = roundMoney(Math.max(0, Math.min(fundsAvailable, balance * cfg.distributablePercent)));

  const eligibleRows = rows.filter((row) => row.eligible);
  distributePool(envelope, eligibleRows, cfg);

  for (const row of rows) {
    if (!row.eligible) continue;
    const manual = manualAdjustments[row.memberId];
    if (Number.isFinite(manual) && manual >= 0) {
      row.proposedPay = Math.min(cfg.memberCap, Math.max(0, roundMoney(manual)));
    }
  }

  const adjustedTotal = rows.reduce((sum, row) => sum + (row.eligible ? row.proposedPay : 0), 0);
  if (adjustedTotal > envelope && adjustedTotal > 0) {
    const scale = envelope / adjustedTotal;
    for (const row of rows) {
      if (!row.eligible) continue;
      row.proposedPay = roundMoney(row.proposedPay * scale);
    }
  }

  const totalProposed = rows.reduce((sum, row) => sum + (row.eligible ? row.proposedPay : 0), 0);

  return {
    weekStartIso: args.weekStartIso,
    weekEndIso: args.weekEndIso,
    generatedAtIso: new Date().toISOString(),
    config: cfg,
    balance,
    reserveKept,
    fundsAvailable,
    envelope,
    totalProposed,
    balanceAfter: balance - totalProposed,
    eligibleCount: rows.filter((row) => row.eligible).length,
    ineligibleCount: rows.filter((row) => !row.eligible).length,
    members: rows.sort((a, b) => (b.eligible ? 1 : 0) - (a.eligible ? 1 : 0) || b.totalScore - a.totalScore || b.proposedPay - a.proposedPay),
    periodMode: args.periodMode ?? 'weekly'
  } satisfies PayrollPreview;
}
