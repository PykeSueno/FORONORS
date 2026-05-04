'use client';

import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { formatUsd } from '@/lib/currency';
import type { PayrollConfig, PayrollMemberRow, PayrollPreview } from '@/lib/payroll';
import type { MemberActivityRow } from '@/lib/payroll-service';

type Tab = 'summary' | 'activities' | 'payroll' | 'expenses' | 'history' | 'logs';
type PeriodMode = 'current' | 'previous' | 'custom';
type HistoryFilter = 'all' | 'payroll' | 'expenses' | 'activities';

type MemberSummary = {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
  moneyGenerated: number;
  activityCount: number;
  proposedPay: number;
  expensesPending: number;
  expensesReimbursed: number;
  lastActivity: string | null;
};

type HistoryPayment = {
  id: number;
  week_start: string;
  week_end: string;
  member_user_id: string | null;
  member_label: string;
  amount: number;
  paid_by: string | null;
  group_balance_before: number;
  group_balance_after: number;
  created_at: string;
};

type Expense = {
  id: number;
  member_id: string | null;
  member_name: string;
  label: string;
  amount: number;
  category: string;
  note: string | null;
  proof_url: string | null;
  status: 'pending' | 'reimbursed' | 'cancelled';
  reimbursed_by: string | null;
  reimbursed_by_name?: string | null;
  reimbursed_at: string | null;
  money_before: number | null;
  money_after: number | null;
  created_at: string;
};

type LogRow = {
  id: number;
  action: string;
  summary: string;
  actor_name: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

type ApiPayload = {
  selected?: PayrollPreview;
  previous?: PayrollPreview;
  state?: { paid: Record<string, number>; adjustments: Record<string, number>; excluded: string[]; reported?: string[] };
  paid?: Record<string, number>;
  adjustments?: Record<string, number>;
  excluded?: string[];
  reported?: string[];
  history?: HistoryPayment[];
  logs?: LogRow[];
  config?: PayrollConfig;
  message?: string;
};

type ExpensePayload = { message?: string; expense?: Expense; cashAfter?: number };

type Props = {
  members: MemberSummary[];
  activities: MemberActivityRow[];
  currentPreview: PayrollPreview;
  previousPreview: PayrollPreview;
  customPreview: PayrollPreview;
  customDefaultStart: string;
  customDefaultEnd: string;
  initialPaidMembers: Record<string, number>;
  initialAdjustments: Record<string, number>;
  initialExcludedIds: string[];
  initialReportedIds: string[];
  history: HistoryPayment[];
  pendingExpenses: Expense[];
  reimbursedExpenses: Expense[];
  expenseStatsRows: Expense[];
  groupCash: number;
  logs: LogRow[];
  canSummary: boolean;
  canActivities: boolean;
  canPayroll: boolean;
  canConfigure: boolean;
  canPay: boolean;
  canAdjust: boolean;
  canExclude: boolean;
  canExpenses: boolean;
  canExpenseCreate: boolean;
  canExpenseReimburse: boolean;
  canHistory: boolean;
  canLogs: boolean;
};

const CATEGORIES = ['Achat stock', 'Materiel', 'Vehicule', 'Braquage', 'Drogue', 'Jobs', 'Autre'];

function firstAllowedTab(props: Pick<Props, 'canSummary' | 'canActivities' | 'canPayroll' | 'canExpenses' | 'canHistory' | 'canLogs'>): Tab {
  if (props.canSummary) return 'summary';
  if (props.canActivities) return 'activities';
  if (props.canPayroll) return 'payroll';
  if (props.canExpenses) return 'expenses';
  if (props.canHistory) return 'history';
  return 'logs';
}

export function ActivityPayrollHubClient(props: Props) {
  const [tab, setTab] = useState<Tab>(() => firstAllowedTab(props));
  const [memberFilter, setMemberFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [activityPeriodFilter, setActivityPeriodFilter] = useState<'all' | 'current' | 'previous'>('current');
  const [dateFilter, setDateFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyMemberFilter, setHistoryMemberFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [customStart, setCustomStart] = useState(props.customDefaultStart.slice(0, 16));
  const [customEnd, setCustomEnd] = useState(props.customDefaultEnd.slice(0, 16));
  const [selectedPreview, setSelectedPreview] = useState<PayrollPreview>(props.currentPreview);
  const [previousPreview, setPreviousPreview] = useState<PayrollPreview>(props.previousPreview);
  const [config, setConfig] = useState<PayrollConfig>(props.currentPreview.config);
  const [paidMembers, setPaidMembers] = useState(props.initialPaidMembers);
  const [adjustments, setAdjustments] = useState(props.initialAdjustments);
  const [excludedIds, setExcludedIds] = useState(props.initialExcludedIds);
  const [reportedIds, setReportedIds] = useState(props.initialReportedIds);
  const [history, setHistory] = useState(props.history);
  const [pendingExpenses, setPendingExpenses] = useState(props.pendingExpenses);
  const [reimbursedExpenses, setReimbursedExpenses] = useState(props.reimbursedExpenses);
  const [expenseStatsRows, setExpenseStatsRows] = useState(props.expenseStatsRows.length ? props.expenseStatsRows : [...props.pendingExpenses, ...props.reimbursedExpenses]);
  const [groupCash, setGroupCash] = useState(props.groupCash);
  const [logs, setLogs] = useState(props.logs);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const previousRange = { startIso: props.previousPreview.weekStartIso, endIso: props.previousPreview.weekEndIso };
  const selectedRange = { startIso: selectedPreview.weekStartIso, endIso: selectedPreview.weekEndIso };

  const modules = useMemo(
    () => Array.from(new Set(props.activities.map((row) => row.module))).sort((a, b) => a.localeCompare(b, 'fr')),
    [props.activities]
  );

  const filteredActivities = useMemo(() => props.activities.filter((row) => {
    if (memberFilter !== 'all' && !row.memberIds.includes(memberFilter)) return false;
    if (moduleFilter !== 'all' && row.module !== moduleFilter) return false;
    if (dateFilter && row.date.slice(0, 10) !== dateFilter) return false;
    if (activityPeriodFilter === 'current' && !(row.date >= props.currentPreview.weekStartIso && row.date < props.currentPreview.weekEndIso)) return false;
    if (activityPeriodFilter === 'previous' && !(row.date >= previousRange.startIso && row.date < previousRange.endIso)) return false;
    return true;
  }), [activityPeriodFilter, dateFilter, memberFilter, moduleFilter, previousRange.endIso, previousRange.startIso, props.activities, props.currentPreview.weekEndIso, props.currentPreview.weekStartIso]);

  const paidTotal = useMemo(() => Object.values(paidMembers).reduce((sum, amount) => sum + Number(amount || 0), 0), [paidMembers]);
  const effectivePreview = useMemo(() => recomputePreview(selectedPreview, config, excludedIds, adjustments), [adjustments, config, excludedIds, selectedPreview]);
  const pendingExpenseTotal = useMemo(() => pendingExpenses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), [pendingExpenses]);
  const reimbursedExpenseTotal = useMemo(() => reimbursedExpenses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), [reimbursedExpenses]);
  const payrollToDo = useMemo(() => effectivePreview.members.reduce((sum, row) => {
    if (!row.eligible || excludedIds.includes(row.memberId) || reportedIds.includes(row.memberId) || paidMembers[row.memberId]) return sum;
    return sum + Number(row.proposedPay ?? 0);
  }, 0), [effectivePreview.members, excludedIds, paidMembers, reportedIds]);

  const topMetrics = useMemo(() => ({
    groupCash,
    payrollToDo,
    paidTotal,
    pendingExpenseTotal,
    reimbursedExpenseTotal,
    balanceAfter: groupCash - payrollToDo - pendingExpenseTotal,
    activeMembers: props.members.filter((member) => member.isActive).length
  }), [groupCash, paidTotal, payrollToDo, pendingExpenseTotal, props.members, reimbursedExpenseTotal]);

  const unifiedHistory = useMemo(() => {
    const payrollRows = history.map((row) => ({
      id: `payroll-${row.id}`,
      kind: 'payroll' as const,
      date: row.created_at,
      memberId: row.member_user_id ?? '',
      member: row.member_label,
      type: 'Paye payee',
      amount: Number(row.amount ?? 0),
      status: 'Paye',
      user: row.paid_by ?? '-',
      before: Number(row.group_balance_before ?? 0),
      after: Number(row.group_balance_after ?? 0)
    }));
    const expenseRows = [...pendingExpenses, ...reimbursedExpenses].flatMap((row) => {
      const created = {
        id: `expense-created-${row.id}`,
        kind: 'expenses' as const,
        date: row.created_at,
        memberId: row.member_id ?? '',
        member: row.member_name,
        type: 'Depense creee',
        amount: Number(row.amount ?? 0),
        status: row.status === 'pending' ? 'En attente' : row.status === 'reimbursed' ? 'Remboursee' : 'Annulee',
        user: '-',
        before: null as number | null,
        after: null as number | null
      };
      if (row.status !== 'reimbursed' || !row.reimbursed_at) return [created];
      return [created, {
        id: `expense-reimbursed-${row.id}`,
        kind: 'expenses' as const,
        date: row.reimbursed_at,
        memberId: row.member_id ?? '',
        member: row.member_name,
        type: 'Depense remboursee',
        amount: Number(row.amount ?? 0),
        status: 'Remboursee',
        user: row.reimbursed_by_name ?? row.reimbursed_by ?? '-',
        before: row.money_before == null ? null : Number(row.money_before),
        after: row.money_after == null ? null : Number(row.money_after)
      }];
    });
    const activityRows = props.activities.slice(0, 120).map((row) => ({
      id: `activity-${row.id}`,
      kind: 'activities' as const,
      date: row.date,
      memberId: row.memberIds[0] ?? '',
      member: row.memberLabels.join(', ') || '-',
      type: row.module,
      amount: Number(row.moneyGenerated ?? 0),
      status: row.action,
      user: '-',
      before: null as number | null,
      after: null as number | null
    }));
    return [...payrollRows, ...expenseRows, ...activityRows]
      .filter((row) => historyFilter === 'all' || row.kind === historyFilter)
      .filter((row) => historyMemberFilter === 'all' || row.memberId === historyMemberFilter || row.member.includes(props.members.find((member) => member.id === historyMemberFilter)?.name ?? ''))
      .filter((row) => !historyDateFilter || row.date.slice(0, 10) === historyDateFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history, historyDateFilter, historyFilter, historyMemberFilter, pendingExpenses, props.activities, props.members, reimbursedExpenses]);

  async function loadPeriod(nextMode: PeriodMode, start = customStart, end = customEnd) {
    setError('');
    setMessage('');
    const query = nextMode === 'custom'
      ? `/api/activity-payroll/payroll?period=custom&start=${encodeURIComponent(new Date(start).toISOString())}&end=${encodeURIComponent(new Date(end).toISOString())}`
      : `/api/activity-payroll/payroll?period=${nextMode}`;
    const response = await fetch(query, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({} as ApiPayload));
    if (!response.ok || !payload.selected || !payload.state) {
      setError(payload.message ?? 'Chargement impossible.');
      return;
    }
    setPeriodMode(nextMode);
    setSelectedPreview(payload.selected);
    if (payload.previous) setPreviousPreview(payload.previous);
    setConfig(payload.selected.config);
    setPaidMembers(payload.state.paid ?? {});
    setAdjustments(payload.state.adjustments ?? {});
    setExcludedIds(payload.state.excluded ?? []);
    setReportedIds(payload.state.reported ?? []);
    if (payload.history) setHistory(payload.history);
    if (payload.logs) setLogs(payload.logs);
    setGroupCash(payload.selected.balance);
  }

  async function saveConfig() {
    if (!props.canConfigure) return;
    setSaving(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/activity-payroll/payroll', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });
    const payload = await response.json().catch(() => ({} as ApiPayload));
    setSaving(false);
    if (!response.ok) {
      setError(payload.message ?? 'Sauvegarde impossible.');
      return;
    }
    if (payload.config) setConfig(payload.config);
    setMessage('Reglages enregistres.');
  }

  async function payrollAction(action: 'pay' | 'adjust' | 'exclude' | 'report', row: PayrollMemberRow, enabled = true) {
    setError('');
    setMessage('');
    const amount = action === 'adjust' ? Number(adjustments[row.memberId] ?? row.proposedPay ?? 0) : Number(row.proposedPay ?? 0);
    const response = await fetch('/api/activity-payroll/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        week_start_iso: selectedPreview.weekStartIso,
        week_end_iso: selectedPreview.weekEndIso,
        member_id: row.memberId,
        member_label: row.memberLabel,
        amount,
        enabled
      })
    });
    const payload = await response.json().catch(() => ({} as ApiPayload));
    if (!response.ok) {
      setError(payload.message ?? 'Action impossible.');
      return;
    }
    if (payload.state?.paid) setPaidMembers(payload.state.paid);
    if (payload.state?.adjustments) setAdjustments(payload.state.adjustments);
    if (payload.state?.excluded) setExcludedIds(payload.state.excluded);
    if (payload.state?.reported) setReportedIds(payload.state.reported);
    if (payload.paid) setPaidMembers(payload.paid);
    if (payload.adjustments) setAdjustments(payload.adjustments);
    if (payload.excluded) setExcludedIds(payload.excluded);
    if (payload.reported) setReportedIds(payload.reported);
    await loadPeriod(periodMode, customStart, customEnd);
    setMessage(action === 'pay' ? 'Membre paye.' : action === 'adjust' ? 'Ajustement enregistre.' : action === 'report' ? (enabled ? 'Paye reportee.' : 'Report annule.') : enabled ? 'Membre exclu.' : 'Membre reinclus.');
  }

  async function createExpense(form: ExpenseFormState, reset: () => void) {
    setError('');
    setMessage('');
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: form.memberId, label: form.label, amount: Number(form.amount), category: form.category, note: form.note, proof_url: form.proofUrl })
    });
    const payload = await response.json().catch(() => ({} as ExpensePayload));
    if (!response.ok || !payload.expense) {
      setError(payload.message ?? 'Creation depense impossible.');
      return;
    }
    setPendingExpenses((rows) => [payload.expense as Expense, ...rows]);
    setExpenseStatsRows((rows) => [payload.expense as Expense, ...rows]);
    reset();
    setMessage('Depense ajoutee en attente. Argent groupe inchange.');
  }

  async function reimburseExpense(row: Expense) {
    setError('');
    setMessage('');
    if (Number(row.amount) >= 5000 && !window.confirm(`Rembourser ${formatUsd(row.amount)} a ${row.member_name} ?`)) return;
    const response = await fetch(`/api/expenses/${row.id}/reimburse`, { method: 'POST' });
    const payload = await response.json().catch(() => ({} as ExpensePayload));
    if (!response.ok || !payload.expense) {
      setError(payload.message ?? 'Remboursement impossible.');
      return;
    }
    setPendingExpenses((rows) => rows.filter((entry) => entry.id !== row.id));
    setReimbursedExpenses((rows) => [payload.expense as Expense, ...rows]);
    setExpenseStatsRows((rows) => {
      const exists = rows.some((entry) => entry.id === row.id);
      return exists ? rows.map((entry) => entry.id === row.id ? payload.expense as Expense : entry) : [payload.expense as Expense, ...rows];
    });
    if (typeof payload.cashAfter === 'number') setGroupCash(payload.cashAfter);
    setMessage('Depense remboursee. Argent groupe mis a jour.');
  }

  function showMember(memberId: string) {
    setMemberFilter(memberId);
    setTab(props.canActivities ? 'activities' : firstAllowedTab(props));
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Metric icon="💰" label="Argent groupe" value={formatUsd(topMetrics.groupCash)} />
        <Metric icon="💸" label="Payes a faire" value={formatUsd(topMetrics.payrollToDo)} />
        <Metric icon="✅" label="Deja paye" value={formatUsd(topMetrics.paidTotal)} />
        <Metric icon="🧾" label="Depenses attente" value={formatUsd(topMetrics.pendingExpenseTotal)} />
        <Metric icon="↩" label="Rembourse" value={formatUsd(topMetrics.reimbursedExpenseTotal)} />
        <Metric icon="📉" label="Solde estime" value={formatUsd(topMetrics.balanceAfter)} />
        <Metric icon="👥" label="Membres actifs" value={String(topMetrics.activeMembers)} />
        <Metric icon="📆" label="Periode" value={`${selectedRange.startIso.slice(5, 10)} > ${selectedRange.endIso.slice(5, 10)}`} />
      </section>

      <section className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          {props.canSummary ? <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>📊 Resume</TabButton> : null}
          {props.canActivities ? <TabButton active={tab === 'activities'} onClick={() => setTab('activities')}>🎯 Activites membres</TabButton> : null}
          {props.canPayroll ? <TabButton active={tab === 'payroll'} onClick={() => setTab('payroll')}>💸 Payes</TabButton> : null}
          {props.canExpenses ? <TabButton active={tab === 'expenses'} onClick={() => setTab('expenses')}>🧾 Depenses</TabButton> : null}
          {props.canHistory ? <TabButton active={tab === 'history'} onClick={() => setTab('history')}>📜 Historique</TabButton> : null}
          {props.canLogs ? <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>🧮 Logs</TabButton> : null}
        </div>
      </section>

      {message ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {tab === 'summary' && props.canSummary ? <SummaryView members={props.members} pendingExpenseTotal={pendingExpenseTotal} payrollToDo={payrollToDo} reimbursedExpenseTotal={reimbursedExpenseTotal} selectedPreview={effectivePreview} onDetail={showMember} /> : null}
      {tab === 'activities' && props.canActivities ? (
        <ActivitiesView activities={filteredActivities} dateFilter={dateFilter} memberFilter={memberFilter} members={props.members} moduleFilter={moduleFilter} modules={modules} periodFilter={activityPeriodFilter} setDateFilter={setDateFilter} setMemberFilter={setMemberFilter} setModuleFilter={setModuleFilter} setPeriodFilter={setActivityPeriodFilter} />
      ) : null}
      {tab === 'payroll' && props.canPayroll ? (
        <PayrollView adjustments={adjustments} canAdjust={props.canAdjust} canConfigure={props.canConfigure} canExclude={props.canExclude} canPay={props.canPay} config={config} customEnd={customEnd} customStart={customStart} effectivePreview={effectivePreview} excludedIds={excludedIds} loadPeriod={loadPeriod} paidMembers={paidMembers} paidTotal={paidTotal} payrollAction={payrollAction} periodMode={periodMode} previousPreview={previousPreview} reportedIds={reportedIds} saveConfig={saveConfig} saving={saving} selectedRange={selectedRange} setConfig={setConfig} setCustomEnd={setCustomEnd} setCustomStart={setCustomStart} updateAdjustment={(memberId, amount) => setAdjustments((cur) => ({ ...cur, [memberId]: Math.max(0, Math.round(amount)) }))} />
      ) : null}
      {tab === 'expenses' && props.canExpenses ? (
        <ExpensesView canCreate={props.canExpenseCreate} canReimburse={props.canExpenseReimburse} groupCash={groupCash} members={props.members} pending={pendingExpenses} reimbursed={reimbursedExpenses} statsRows={expenseStatsRows} onCreate={createExpense} onReimburse={reimburseExpense} />
      ) : null}
      {tab === 'history' && props.canHistory ? (
        <UnifiedHistoryView rows={unifiedHistory} filter={historyFilter} memberFilter={historyMemberFilter} dateFilter={historyDateFilter} members={props.members} setFilter={setHistoryFilter} setMemberFilter={setHistoryMemberFilter} setDateFilter={setHistoryDateFilter} />
      ) : null}
      {tab === 'logs' && props.canLogs ? <LogsView rows={logs} /> : null}
    </div>
  );
}

function recomputePreview(preview: PayrollPreview, cfg: PayrollConfig, excluded: string[], adjustments: Record<string, number>): PayrollPreview {
  const maxMoney = Math.max(1, ...preview.members.map((row) => Number(row.moneyContribution ?? 0)));
  const maxActivity = Math.max(1, ...preview.members.map((row) => Number(row.activityCount ?? 0)));
  const maxParticipation = Math.max(1, ...preview.members.map((row) => Number(row.participationCount ?? 0)));
  const reserveKept = Math.max(0, Number(cfg.reserveMinimum ?? 0));
  const fundsAvailable = Math.max(0, preview.balance - reserveKept);
  const envelope = Math.round(Math.max(0, Math.min(fundsAvailable, preview.balance * Number(cfg.distributablePercent ?? 0))));
  const excludedSet = new Set(excluded);
  const rows = preview.members.map((row) => {
    const hasEligibilitySignal = Number(row.activityCount ?? 0) >= cfg.minActions || Number(row.moneyContribution ?? 0) >= cfg.minMoney;
    const excludedMember = excludedSet.has(row.memberId);
    const eligible = Boolean(row.isActive) && hasEligibilitySignal && !excludedMember;
    const moneyScore = Number(row.moneyContribution ?? 0) / maxMoney;
    const activityScore = Number(row.activityCount ?? 0) / maxActivity;
    const participationScore = Number(row.participationCount ?? 0) / maxParticipation;
    const totalScore = eligible ? (moneyScore * cfg.weights.money) + (activityScore * cfg.weights.activity) + (participationScore * cfg.weights.participation) : 0;
    return { ...row, eligible, reason: excludedMember ? 'Exclu manuellement' : eligible ? 'Eligible' : row.reason, moneyScore, activityScore, participationScore, totalScore, proposedPay: 0 };
  });
  const eligibleRows = rows.filter((row) => row.eligible);
  const totalScore = eligibleRows.reduce((sum, row) => sum + row.totalScore, 0);
  if (envelope > 0 && totalScore > 0) {
    for (const row of eligibleRows) row.proposedPay = Math.min(cfg.memberCap, Math.max(cfg.memberMinimum, Math.round(envelope * (row.totalScore / totalScore))));
    const total = eligibleRows.reduce((sum, row) => sum + row.proposedPay, 0);
    if (total > envelope && total > 0) {
      const scale = envelope / total;
      for (const row of eligibleRows) row.proposedPay = Math.max(0, Math.round(row.proposedPay * scale));
    }
  }
  for (const row of rows) {
    const adjusted = Number(adjustments[row.memberId]);
    if (row.eligible && Number.isFinite(adjusted) && adjusted >= 0) row.proposedPay = Math.min(cfg.memberCap, Math.round(adjusted));
  }
  const adjustedTotal = rows.reduce((sum, row) => sum + (row.eligible ? row.proposedPay : 0), 0);
  if (adjustedTotal > envelope && adjustedTotal > 0) {
    const scale = envelope / adjustedTotal;
    for (const row of rows) if (row.eligible) row.proposedPay = Math.max(0, Math.round(row.proposedPay * scale));
  }
  const totalProposed = rows.reduce((sum, row) => sum + (row.eligible ? row.proposedPay : 0), 0);
  return { ...preview, config: cfg, reserveKept, fundsAvailable, envelope, members: rows, totalProposed, balanceAfter: preview.balance - totalProposed, eligibleCount: rows.filter((row) => row.eligible).length, ineligibleCount: rows.filter((row) => !row.eligible).length };
}

function SummaryView({ members, pendingExpenseTotal, payrollToDo, reimbursedExpenseTotal, selectedPreview, onDetail }: { members: MemberSummary[]; pendingExpenseTotal: number; payrollToDo: number; reimbursedExpenseTotal: number; selectedPreview: PayrollPreview; onDetail: (memberId: string) => void }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Metric icon="💰" label="Argent groupe" value={formatUsd(selectedPreview.balance)} />
        <Metric icon="💸" label="Total payes a faire" value={formatUsd(payrollToDo)} />
        <Metric icon="🧾" label="Depenses en attente" value={formatUsd(pendingExpenseTotal)} />
        <Metric icon="📉" label="Apres payes + remboursements" value={formatUsd(selectedPreview.balance - payrollToDo - pendingExpenseTotal)} />
      </section>
      <section className="glass-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#fff1dd]">Par membre</h2>
          <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{members.length} membres actifs</span>
        </div>
        <div className="grid gap-2 xl:grid-cols-2">
          {members.map((member) => (
            <article key={member.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <div className="grid gap-3 sm:grid-cols-[1.1fr_repeat(5,minmax(0,1fr))_auto] sm:items-center">
                <div><p className="font-semibold text-[#ffe8ca]">{member.name || member.username}</p><p className="text-xs text-[#efcdab]">{member.isActive ? 'Actif' : 'Inactif'}</p></div>
                <Mini icon="💰" label="Argent" value={formatUsd(member.moneyGenerated)} />
                <Mini icon="🎯" label="Actions" value={String(member.activityCount)} />
                <Mini icon="💸" label="Paye" value={formatUsd(member.proposedPay)} />
                <Mini icon="🧾" label="Avance" value={formatUsd(member.expensesPending)} />
                <Mini icon="✅" label="Rembourse" value={formatUsd(member.expensesReimbursed)} />
                <button className="saas-primary-btn !h-9 whitespace-nowrap px-3" onClick={() => onDetail(member.id)}>Detail</button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#d9b48f]">Depense = remboursement separe. Paye = salaire. Les deux restent visibles sans se melanger.</p>
      </section>
      <section className="grid gap-2 md:grid-cols-3">
        <Metric icon="✅" label="Total rembourse" value={formatUsd(reimbursedExpenseTotal)} />
        <Metric icon="📦" label="Enveloppe paye" value={formatUsd(selectedPreview.envelope)} />
        <Metric icon="👥" label="Eligibles paye" value={String(selectedPreview.eligibleCount)} />
      </section>
    </div>
  );
}

function ActivitiesView(props: { activities: MemberActivityRow[]; members: MemberSummary[]; modules: string[]; memberFilter: string; moduleFilter: string; periodFilter: 'all' | 'current' | 'previous'; dateFilter: string; setMemberFilter: (value: string) => void; setModuleFilter: (value: string) => void; setPeriodFilter: (value: 'all' | 'current' | 'previous') => void; setDateFilter: (value: string) => void }) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3 grid gap-2 lg:grid-cols-4">
        <select className="saas-input !h-10" value={props.memberFilter} onChange={(event) => props.setMemberFilter(event.target.value)}><option value="all">Tous les membres</option>{props.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}</select>
        <select className="saas-input !h-10" value={props.moduleFilter} onChange={(event) => props.setModuleFilter(event.target.value)}><option value="all">Tous les modules</option>{props.modules.map((module) => <option key={module} value={module}>{module}</option>)}</select>
        <select className="saas-input !h-10" value={props.periodFilter} onChange={(event) => props.setPeriodFilter(event.target.value as 'all' | 'current' | 'previous')}><option value="current">Semaine actuelle</option><option value="previous">Semaine passee</option><option value="all">Tout</option></select>
        <input className="saas-input !h-10" type="date" value={props.dateFilter} onChange={(event) => props.setDateFilter(event.target.value)} />
      </div>
      <div className="max-h-[620px] overflow-auto pr-1">
        <table className="min-w-full text-left text-xs text-[#efcdab]"><thead className="sticky top-0 bg-[#2b1a12] text-[#ffe8ca]"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Membre</th><th className="px-2 py-2">Module</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Argent</th><th className="px-2 py-2">Participation</th><th className="px-2 py-2">Details</th></tr></thead><tbody>{props.activities.map((row) => <tr key={row.id} className="border-t border-white/10"><td className="whitespace-nowrap px-2 py-2">{new Date(row.date).toLocaleString('fr-FR')}</td><td className="px-2 py-2 text-[#ffe8ca]">{row.memberLabels.join(', ') || '-'}</td><td className="px-2 py-2">{row.module}</td><td className="px-2 py-2">{row.action}</td><td className="px-2 py-2 font-semibold text-[#ffe8ca]">{formatUsd(row.moneyGenerated)}</td><td className="px-2 py-2">{row.participation}</td><td className="px-2 py-2">{row.details || '-'}</td></tr>)}</tbody></table>
        {props.activities.length === 0 ? <p className="p-3 text-xs text-[#efcdab]">Aucune activite.</p> : null}
      </div>
    </section>
  );
}

function PayrollView(props: { canAdjust: boolean; canConfigure: boolean; canExclude: boolean; canPay: boolean; config: PayrollConfig; customEnd: string; customStart: string; effectivePreview: PayrollPreview; excludedIds: string[]; paidMembers: Record<string, number>; paidTotal: number; periodMode: PeriodMode; previousPreview: PayrollPreview; reportedIds: string[]; saving: boolean; selectedRange: { startIso: string; endIso: string }; setConfig: Dispatch<SetStateAction<PayrollConfig>>; setCustomEnd: (value: string) => void; setCustomStart: (value: string) => void; adjustments: Record<string, number>; updateAdjustment: (memberId: string, amount: number) => void; loadPeriod: (mode: PeriodMode, start?: string, end?: string) => Promise<void>; payrollAction: (action: 'pay' | 'adjust' | 'exclude' | 'report', row: PayrollMemberRow, enabled?: boolean) => Promise<void>; saveConfig: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-2 lg:grid-cols-6"><Metric icon="💳" label="Argent groupe" value={formatUsd(props.effectivePreview.balance)} /><Metric icon="🛡" label="Reserve" value={formatUsd(props.effectivePreview.reserveKept)} /><Metric icon="📦" label="Enveloppe" value={formatUsd(props.effectivePreview.envelope)} /><Metric icon="✅" label="Calcule" value={formatUsd(props.effectivePreview.totalProposed)} /><Metric icon="🏦" label="Deja paye" value={formatUsd(props.paidTotal)} /><Metric icon="👥" label="Eligibles" value={String(props.effectivePreview.eligibleCount)} /></section>
      <section className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">Periode de calcul</h3><div className="mt-2 flex flex-wrap gap-2"><button className={`filter-pill ${props.periodMode === 'current' ? 'filter-pill-active' : ''}`} onClick={() => void props.loadPeriod('current')}>Semaine actuelle</button><button className={`filter-pill ${props.periodMode === 'previous' ? 'filter-pill-active' : ''}`} onClick={() => void props.loadPeriod('previous')}>Semaine passee</button><button className={`filter-pill ${props.periodMode === 'custom' ? 'filter-pill-active' : ''}`} onClick={() => void props.loadPeriod('custom')}>Personnalisee</button></div>{props.periodMode === 'custom' ? <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input className="saas-input" type="datetime-local" value={props.customStart} onChange={(event) => props.setCustomStart(event.target.value)} /><input className="saas-input" type="datetime-local" value={props.customEnd} onChange={(event) => props.setCustomEnd(event.target.value)} /><button className="saas-primary-btn" onClick={() => void props.loadPeriod('custom', props.customStart, props.customEnd)}>Appliquer</button></div> : null}<p className="mt-2 text-xs text-[#efcdab]">Active: {props.selectedRange.startIso.slice(0, 10)} - {props.selectedRange.endIso.slice(0, 10)} | Exclusions: {props.excludedIds.length} | Reports: {props.reportedIds.length}</p></section>
      <section className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">Comparaison</h3><div className="mt-2 grid gap-2 md:grid-cols-2"><CompareCard title="Periode active" preview={props.effectivePreview} /><CompareCard title="Semaine passee" preview={props.previousPreview} /></div></section>
      {props.canConfigure ? <Settings config={props.config} saving={props.saving} setConfig={props.setConfig} saveConfig={props.saveConfig} /> : null}
      <section className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">Payes membres</h3><div className="mt-2 max-h-[560px] space-y-2 overflow-auto pr-1">{props.effectivePreview.members.map((member) => { const isPaid = Boolean(props.paidMembers[member.memberId]); const isExcluded = props.excludedIds.includes(member.memberId); const isReported = props.reportedIds.includes(member.memberId); const status = isPaid ? 'Paye' : isExcluded ? 'Exclu' : isReported ? 'Reporte' : member.eligible ? 'A payer' : member.reason; return <article key={member.memberId} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="grid gap-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_360px] xl:items-center"><div><p className="font-semibold text-[#ffe8ca]">{member.memberLabel}</p><p>{status}</p></div><Mini icon="💰" label="Argent" value={formatUsd(member.moneyContribution)} /><Mini icon="🎯" label="Actions" value={String(member.activityCount)} /><Mini icon="🤝" label="Implication" value={String(member.participationCount)} /><Mini icon="📊" label="Score" value={member.totalScore.toFixed(2)} /><Mini icon="💸" label="Paye" value={formatUsd(member.proposedPay)} /><div className="flex flex-wrap justify-end gap-2">{props.canAdjust ? <input className="saas-input !h-9 w-24" value={props.adjustments[member.memberId] ?? ''} placeholder="Ajuster" onChange={(event) => props.updateAdjustment(member.memberId, Number(event.target.value || 0))} /> : null}{props.canAdjust ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('adjust', member)}>Ajuster</button> : null}{props.canAdjust ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('report', member, !isReported)}>{isReported ? 'Reprendre' : 'Reporter'}</button> : null}{props.canExclude ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('exclude', member, !isExcluded)}>{isExcluded ? 'Reinclure' : 'Exclure'}</button> : null}{props.canPay ? <button className="saas-primary-btn !h-9 px-3" disabled={isPaid || isExcluded || isReported || !member.eligible || member.proposedPay <= 0} onClick={() => void props.payrollAction('pay', member)}>{isPaid ? 'Paye' : 'Payer'}</button> : null}</div></div></article>; })}</div></section>
    </div>
  );
}

type ExpenseFormState = { memberId: string; label: string; amount: string; category: string; note: string; proofUrl: string };

function ExpensesView({ canCreate, canReimburse, groupCash, members, pending, reimbursed, statsRows, onCreate, onReimburse }: { canCreate: boolean; canReimburse: boolean; groupCash: number; members: MemberSummary[]; pending: Expense[]; reimbursed: Expense[]; statsRows: Expense[]; onCreate: (form: ExpenseFormState, reset: () => void) => Promise<void>; onReimburse: (row: Expense) => Promise<void> }) {
  const [mode, setMode] = useState<'new' | 'pending' | 'reimbursed' | 'stats'>('pending');
  const [form, setForm] = useState<ExpenseFormState>({ memberId: members[0]?.id ?? '', label: '', amount: '', category: 'Achat stock', note: '', proofUrl: '' });
  const allRows = useMemo(() => statsRows.length ? statsRows : [...pending, ...reimbursed], [pending, reimbursed, statsRows]);
  const totals = useMemo(() => ({
    pending: pending.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    reimbursed: reimbursed.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    count: allRows.length
  }), [allRows.length, pending, reimbursed]);
  const byCategory = useMemo(() => groupExpenses(allRows, (row) => row.category), [allRows]);
  const byMember = useMemo(() => groupExpenses(allRows, (row) => row.member_name), [allRows]);
  const reset = () => setForm({ memberId: members[0]?.id ?? '', label: '', amount: '', category: 'Achat stock', note: '', proofUrl: '' });

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4"><Metric icon="🧾" label="En attente" value={formatUsd(totals.pending)} /><Metric icon="✅" label="Rembourse" value={formatUsd(totals.reimbursed)} /><Metric icon="📌" label="Depenses" value={String(totals.count)} /><Metric icon="💰" label="Argent groupe" value={formatUsd(groupCash)} /></section>
      <section className="glass-card p-3"><div className="flex flex-wrap gap-2">{canCreate ? <TabButton active={mode === 'new'} onClick={() => setMode('new')}>Ajouter</TabButton> : null}<TabButton active={mode === 'pending'} onClick={() => setMode('pending')}>En attente</TabButton><TabButton active={mode === 'reimbursed'} onClick={() => setMode('reimbursed')}>Remboursees</TabButton><TabButton active={mode === 'stats'} onClick={() => setMode('stats')}>Stats</TabButton></div></section>
      {mode === 'new' && canCreate ? <section className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">Nouvelle depense</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Membre"><select className="saas-input" value={form.memberId} onChange={(event) => setForm((cur) => ({ ...cur, memberId: event.target.value }))}>{members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}</select></Field><Field label="Categorie"><select className="saas-input" value={form.category} onChange={(event) => setForm((cur) => ({ ...cur, category: event.target.value }))}>{CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></Field><Field label="Libelle"><input className="saas-input" value={form.label} onChange={(event) => setForm((cur) => ({ ...cur, label: event.target.value }))} placeholder="Ex: Materiel groupe" /></Field><Field label="Montant"><input className="saas-input" value={form.amount} onChange={(event) => setForm((cur) => ({ ...cur, amount: event.target.value }))} inputMode="decimal" placeholder="0" /></Field><Field label="Preuve image (URL optionnelle)"><input className="saas-input" value={form.proofUrl} onChange={(event) => setForm((cur) => ({ ...cur, proofUrl: event.target.value }))} placeholder="https://..." /></Field><Field label="Note optionnelle"><input className="saas-input" value={form.note} onChange={(event) => setForm((cur) => ({ ...cur, note: event.target.value }))} placeholder="Detail utile" /></Field></div><button className="saas-primary-btn mt-4" disabled={!form.memberId || !form.label.trim() || Number(form.amount) <= 0} onClick={() => void onCreate(form, reset)}>Ajouter depense</button><p className="mt-2 text-xs text-[#d9b48f]">La creation ne retire pas d argent du groupe.</p></section> : null}
      {mode === 'pending' ? <ExpenseList rows={pending} empty="Aucune depense en attente." actions={(row) => canReimburse ? <button className="saas-primary-btn !h-9 px-3 text-xs" onClick={() => void onReimburse(row)}>Rembourser</button> : null} /> : null}
      {mode === 'reimbursed' ? <ExpenseList rows={reimbursed} empty="Aucune depense remboursee." /> : null}
      {mode === 'stats' ? <section className="grid gap-4 xl:grid-cols-2"><StatsBlock title="Depenses par categorie" rows={byCategory} /><StatsBlock title="Depenses par membre" rows={byMember} /></section> : null}
    </div>
  );
}

function UnifiedHistoryView({ rows, filter, memberFilter, dateFilter, members, setFilter, setMemberFilter, setDateFilter }: { rows: Array<{ id: string; kind: 'payroll' | 'expenses' | 'activities'; date: string; memberId: string; member: string; type: string; amount: number; status: string; user: string; before: number | null; after: number | null }>; filter: HistoryFilter; memberFilter: string; dateFilter: string; members: MemberSummary[]; setFilter: (value: HistoryFilter) => void; setMemberFilter: (value: string) => void; setDateFilter: (value: string) => void }) {
  return <section className="glass-card p-4"><div className="mb-3 grid gap-2 md:grid-cols-3"><select className="saas-input !h-10" value={filter} onChange={(event) => setFilter(event.target.value as HistoryFilter)}><option value="all">Tous</option><option value="payroll">Payes</option><option value="expenses">Depenses</option><option value="activities">Activites</option></select><select className="saas-input !h-10" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="all">Tous les membres</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}</select><input className="saas-input !h-10" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div><div className="max-h-[620px] space-y-2 overflow-auto pr-1">{rows.map((row) => <article key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">{row.member} - {row.type}</p><p>{new Date(row.date).toLocaleString('fr-FR')}</p></div><p>Montant: {formatUsd(row.amount)} | Statut: {row.status} | Utilisateur: {row.user}</p>{row.before != null && row.after != null ? <p>Argent groupe: {formatUsd(row.before)} - {formatUsd(row.after)}</p> : null}</article>)}{rows.length === 0 ? <p className="text-xs text-[#efcdab]">Aucun historique.</p> : null}</div></section>;
}

function LogsView({ rows }: { rows: LogRow[] }) {
  return <section className="glass-card p-4"><h2 className="mb-3 text-base font-semibold text-[#fff1dd]">Logs</h2><div className="max-h-[620px] space-y-2 overflow-auto pr-1">{rows.map((row) => <article key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">{row.action}</p><p>{new Date(row.created_at).toLocaleString('fr-FR')}</p></div><p>{row.summary}</p><p>Utilisateur: {row.actor_name || '-'}</p></article>)}{rows.length === 0 ? <p className="text-xs text-[#efcdab]">Aucun log.</p> : null}</div></section>;
}

const TOOLTIP = {
  reserve: 'Argent minimum a garder dans le groupe apres calcul des payes.',
  percent: 'Pourcentage de l argent disponible qui peut etre redistribue aux membres.',
  cap: 'Montant maximum qu un membre peut recevoir sur une periode.',
  minimum: 'Montant minimum verse a un membre eligible.',
  money: 'Importance de l argent genere dans le calcul de la paye.',
  activity: 'Importance du nombre d activites realisees dans le calcul.',
  participation: 'Importance de la participation globale du membre.',
  actions: 'Nombre minimum d activites pour etre eligible.',
  minMoney: 'Montant minimum genere pour etre eligible.'
};

function Settings({ config, saving, setConfig, saveConfig }: { config: PayrollConfig; saving: boolean; setConfig: Dispatch<SetStateAction<PayrollConfig>>; saveConfig: () => Promise<void> }) {
  return <section className="glass-card space-y-3 p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">Reglages paye</h3><div className="grid gap-2 md:grid-cols-4"><NumberField label="Reserve minimale" tooltip={TOOLTIP.reserve} value={config.reserveMinimum} onChange={(v) => setConfig((cur) => ({ ...cur, reserveMinimum: v }))} /><NumberField label="% distribuable" tooltip={TOOLTIP.percent} value={Math.round(config.distributablePercent * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, distributablePercent: Math.max(0, Math.min(100, v)) / 100 }))} /><NumberField label="Plafond membre" tooltip={TOOLTIP.cap} value={config.memberCap} onChange={(v) => setConfig((cur) => ({ ...cur, memberCap: v }))} /><NumberField label="Minimum membre" tooltip={TOOLTIP.minimum} value={config.memberMinimum} onChange={(v) => setConfig((cur) => ({ ...cur, memberMinimum: v }))} /></div><div className="grid gap-2 md:grid-cols-5"><NumberField label="Poids argent (%)" tooltip={TOOLTIP.money} value={Math.round(config.weights.money * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, weights: { ...cur.weights, money: v / 100 } }))} /><NumberField label="Poids activite (%)" tooltip={TOOLTIP.activity} value={Math.round(config.weights.activity * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, weights: { ...cur.weights, activity: v / 100 } }))} /><NumberField label="Poids implication (%)" tooltip={TOOLTIP.participation} value={Math.round(config.weights.participation * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, weights: { ...cur.weights, participation: v / 100 } }))} /><NumberField label="Seuil actions" tooltip={TOOLTIP.actions} value={config.minActions} onChange={(v) => setConfig((cur) => ({ ...cur, minActions: v }))} /><NumberField label="Seuil argent" tooltip={TOOLTIP.minMoney} value={config.minMoney} onChange={(v) => setConfig((cur) => ({ ...cur, minMoney: v }))} /></div><button className="saas-primary-btn" disabled={saving} onClick={() => void saveConfig()}>{saving ? 'Enregistrement...' : 'Enregistrer les reglages'}</button></section>;
}

function groupExpenses(rows: Expense[], key: (row: Expense) => string) {
  const map = new Map<string, { label: string; count: number; pending: number; reimbursed: number; total: number }>();
  for (const row of rows) {
    const label = key(row) || 'Autre';
    const current = map.get(label) ?? { label, count: 0, pending: 0, reimbursed: 0, total: 0 };
    current.count += 1;
    current.total += Number(row.amount ?? 0);
    if (row.status === 'pending') current.pending += Number(row.amount ?? 0);
    if (row.status === 'reimbursed') current.reimbursed += Number(row.amount ?? 0);
    map.set(label, current);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function ExpenseList({ rows, empty, actions }: { rows: Expense[]; empty: string; actions?: (row: Expense) => ReactNode }) {
  return <section className="space-y-2">{rows.map((row) => <article key={row.id} className="glass-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><CompactExpense row={row} />{actions ? <div className="flex gap-2">{actions(row)}</div> : null}</div></article>)}{rows.length === 0 ? <article className="glass-card p-4 text-sm text-[#efcdab]">{empty}</article> : null}</section>;
}

function CompactExpense({ row }: { row: Expense }) {
  return <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1 text-xs text-[#efcdab]">{row.category}</span><span className="rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1 text-xs text-[#efcdab]">{row.status === 'pending' ? 'En attente' : row.status === 'reimbursed' ? 'Remboursee' : 'Annulee'}</span></div><h3 className="mt-2 text-base font-semibold text-[#fff1dd]">{row.member_name} - {row.label}</h3><p className="text-lg font-semibold text-[#ffe8ca]">{formatUsd(row.amount)}</p><p className="text-xs text-[#efcdab]">Creee le {new Date(row.created_at).toLocaleString('fr-FR')}{row.reimbursed_at ? ` | Remboursee le ${new Date(row.reimbursed_at).toLocaleString('fr-FR')}` : ''}</p>{row.reimbursed_by_name ? <p className="text-xs text-[#d9b48f]">Rembourse par {row.reimbursed_by_name}</p> : null}{row.note ? <p className="mt-1 text-sm text-[#efcdab]">{row.note}</p> : null}{row.proof_url ? <a className="mt-1 inline-block text-xs text-[#ffe8ca] underline" href={row.proof_url} target="_blank" rel="noreferrer">Voir preuve</a> : null}{row.money_before != null && row.money_after != null ? <p className="mt-1 text-xs text-[#d9b48f]">Groupe {formatUsd(row.money_before)} - {formatUsd(row.money_after)}</p> : null}</div>;
}

function StatsBlock({ title, rows }: { title: string; rows: Array<{ label: string; count: number; pending: number; reimbursed: number; total: number }> }) {
  return <article className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">{title}</h3><div className="mt-2 space-y-2">{rows.map((row) => <div key={row.label} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]"><div className="flex justify-between gap-2"><b className="text-[#ffe8ca]">{row.label}</b><span>{row.count}</span></div><p>En attente {formatUsd(row.pending)} | Rembourse {formatUsd(row.reimbursed)}</p></div>)}{rows.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune donnee.</p> : null}</div></article>;
}

function CompareCard({ title, preview }: { title: string; preview: PayrollPreview }) { return <article className="rounded-xl border border-white/10 bg-[#3b2518]/60 p-3 text-xs text-[#efcdab]"><p className="font-semibold text-[#ffe8ca]">{title}</p><p>{preview.weekStartIso.slice(0, 10)} - {preview.weekEndIso.slice(0, 10)}</p><p>Eligibles: {preview.eligibleCount} | Enveloppe: {formatUsd(preview.envelope)} | Total: {formatUsd(preview.totalProposed)}</p></article>; }
function Metric({ icon, label, value }: { icon: string; label: string; value: string }) { return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="text-lg font-semibold text-[#ffe8ca]">{value}</p></article>; }
function Mini({ icon, label, value }: { icon: string; label: string; value: string }) { return <div><p className="text-[11px] text-[#efcdab]">{icon} {label}</p><p className="font-semibold text-[#ffe8ca]">{value}</p></div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" className={`filter-pill ${active ? 'filter-pill-active' : ''}`} onClick={onClick}>{children}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs text-[#efcdab]"><span className="mb-1 block">{label}</span>{children}</label>; }
function NumberField({ label, tooltip, value, onChange }: { label: string; tooltip: string; value: number; onChange: (next: number) => void }) { return <label title={tooltip} className="group relative rounded-xl border border-white/10 bg-[#3f281b]/55 p-2 text-xs text-[#efcdab]"><span className="flex items-center gap-1">{label} <span className="rounded-full border border-white/10 px-1 text-[10px] text-[#ffe8ca]">?</span></span><input className="saas-input mt-1" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))} /><span className="pointer-events-none absolute left-2 right-2 top-full z-20 mt-1 hidden rounded-lg border border-white/10 bg-[#21130d]/95 p-2 text-[11px] text-[#ffe8ca] shadow-xl group-hover:block">{tooltip}</span></label>; }
