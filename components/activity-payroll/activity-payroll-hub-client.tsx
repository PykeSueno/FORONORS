'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { formatUsd } from '@/lib/currency';
import type { PayrollConfig, PayrollMemberRow, PayrollPreview } from '@/lib/payroll';
import type { MemberActivityRow } from '@/lib/payroll-service';

type Page = 'activities' | 'payroll' | 'expenses';
type PeriodMode = 'current' | 'previous' | 'custom';

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
  canReport: boolean;
  canExclude: boolean;
  canExpenses: boolean;
  canExpenseCreate: boolean;
  canExpenseReimburse: boolean;
  canExpenseCancel: boolean;
  canHistory: boolean;
  canLogs: boolean;
};

const CATEGORIES = ['Achat stock', 'Matériel', 'Véhicule', 'Braquage', 'Drogue', 'Jobs', 'Autre'];
const JOB_MODULES = ['Jobs Tablette', 'Jobs Cigarette', 'Jobs Processeur'];
const MODULE_ORDER = [...JOB_MODULES, 'Drogues', 'Braquage', 'FOUR', 'Vente objets', 'Activité', 'Cargo', 'GoFast'];
const MODULE_FILTERS = [
  { value: 'Jobs', label: 'Jobs' },
  { value: 'Jobs Tablette', label: 'Tablette' },
  { value: 'Jobs Cigarette', label: 'Cigarette' },
  { value: 'Jobs Processeur', label: 'Processeur' },
  { value: 'Drogues', label: 'Drogues' },
  { value: 'Braquage', label: 'Braquage' },
  { value: 'FOUR', label: 'FOUR' },
  { value: 'Vente objets', label: 'Vente objets' },
  { value: 'Activité', label: 'Activité' },
  { value: 'Cargo', label: 'Cargo' },
  { value: 'GoFast', label: 'GoFast' }
];

function firstPage(props: Pick<Props, 'canActivities' | 'canPayroll' | 'canExpenses'>): Page {
  if (props.canActivities) return 'activities';
  if (props.canPayroll) return 'payroll';
  return 'expenses';
}

export function ActivityPayrollHubClient(props: Props) {
  const [page, setPage] = useState<Page>(() => firstPage(props));
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [customStart, setCustomStart] = useState(props.customDefaultStart.slice(0, 16));
  const [customEnd, setCustomEnd] = useState(props.customDefaultEnd.slice(0, 16));
  const [selectedPreview, setSelectedPreview] = useState<PayrollPreview>(props.currentPreview);
  const [previousPreview, setPreviousPreview] = useState(props.previousPreview);
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
  const [memberFilter, setMemberFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'current' | 'previous'>('current');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const paidTotal = useMemo(() => Object.values(paidMembers).reduce((sum, amount) => sum + Number(amount || 0), 0), [paidMembers]);
  const effectivePreview = useMemo(() => recomputePreview(selectedPreview, excludedIds, adjustments), [adjustments, excludedIds, selectedPreview]);
  const remainingPayroll = useMemo(() => effectivePreview.members.reduce((sum, row) => {
    if (!row.eligible || paidMembers[row.memberId] || excludedIds.includes(row.memberId) || reportedIds.includes(row.memberId)) return sum;
    return sum + Number(row.proposedPay ?? 0);
  }, 0), [effectivePreview.members, excludedIds, paidMembers, reportedIds]);

  const modules = useMemo(() => {
    const existing = new Set(props.activities.map((row) => row.module));
    const known = MODULE_FILTERS.filter((entry) => entry.value === 'Jobs' ? JOB_MODULES.some((module) => existing.has(module)) : existing.has(entry.value));
    const custom = Array.from(existing)
      .filter((entry) => !MODULE_ORDER.includes(entry))
      .map((entry) => ({ value: entry, label: entry }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    return known.concat(custom);
  }, [props.activities]);

  const filteredActivities = useMemo(() => props.activities.filter((row) => {
    if (memberFilter !== 'all' && !row.memberIds.includes(memberFilter)) return false;
    if (moduleFilter === 'Jobs' && !JOB_MODULES.includes(row.module)) return false;
    if (moduleFilter !== 'all' && moduleFilter !== 'Jobs' && row.module !== moduleFilter) return false;
    if (periodFilter === 'current' && !(row.date >= selectedPreview.weekStartIso && row.date < selectedPreview.weekEndIso)) return false;
    if (periodFilter === 'previous' && !(row.date >= previousPreview.weekStartIso && row.date < previousPreview.weekEndIso)) return false;
    return true;
  }), [memberFilter, moduleFilter, periodFilter, previousPreview.weekEndIso, previousPreview.weekStartIso, props.activities, selectedPreview.weekEndIso, selectedPreview.weekStartIso]);

  const activityCards = useMemo(() => {
    const byMember = new Map<string, {
      member: MemberSummary;
      money: number;
      actions: number;
      participation: number;
      last: string | null;
      modules: Record<string, { count: number; money: number }>;
      recent: MemberActivityRow[];
    }>();
    const visibleMembers = props.members.filter((member) => memberFilter === 'all' || member.id === memberFilter);
    for (const member of visibleMembers) {
      byMember.set(member.id, { member, money: 0, actions: 0, participation: 0, last: null, modules: {}, recent: [] });
    }
    for (const row of filteredActivities) {
      const share = row.memberIds.length > 0 ? Number(row.moneyGenerated ?? 0) / row.memberIds.length : Number(row.moneyGenerated ?? 0);
      for (const memberId of row.memberIds) {
        const target = byMember.get(memberId);
        if (!target) continue;
        target.money += share;
        target.actions += 1;
        target.participation += Number(row.participation ?? 0);
        target.last = !target.last || new Date(row.date).getTime() > new Date(target.last).getTime() ? row.date : target.last;
        const mod = target.modules[row.module] ?? { count: 0, money: 0 };
        mod.count += 1;
        mod.money += share;
        target.modules[row.module] = mod;
        if (target.recent.length < 4) target.recent.push(row);
      }
    }
    return Array.from(byMember.values()).filter((row) => row.actions > 0).sort((a, b) => b.money - a.money || b.actions - a.actions);
  }, [filteredActivities, memberFilter, props.members]);

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
    setPaidMembers(payload.state.paid ?? {});
    setAdjustments(payload.state.adjustments ?? {});
    setExcludedIds(payload.state.excluded ?? []);
    setReportedIds(payload.state.reported ?? []);
    if (payload.history) setHistory(payload.history);
    if (payload.logs) setLogs(payload.logs);
    setGroupCash(payload.selected.balance);
  }

  async function payrollAction(action: 'pay' | 'adjust' | 'exclude' | 'report', row: PayrollMemberRow, enabled = true) {
    setError('');
    setMessage('');
    let amount = Number(row.proposedPay ?? 0);
    if (action === 'adjust') {
      const input = window.prompt(`Nouvelle paye pour ${row.memberLabel}`, String(adjustments[row.memberId] ?? row.proposedPay ?? 0));
      if (input == null) return;
      amount = Math.max(0, Math.round(Number(input || 0)));
    }
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
    if (payload.paid) setPaidMembers(payload.paid);
    if (payload.adjustments) setAdjustments(payload.adjustments);
    if (payload.excluded) setExcludedIds(payload.excluded);
    if (payload.reported) setReportedIds(payload.reported);
    await loadPeriod(periodMode, customStart, customEnd);
    setMessage(action === 'pay' ? 'Paye enregistrée.' : action === 'adjust' ? 'Paye ajustée.' : action === 'report' ? (enabled ? 'Paye reportée.' : 'Report annulé.') : enabled ? 'Membre exclu.' : 'Membre réintégré.');
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
      setError(payload.message ?? 'Création dépense impossible.');
      return;
    }
    setPendingExpenses((rows) => [payload.expense as Expense, ...rows]);
    setExpenseStatsRows((rows) => [payload.expense as Expense, ...rows]);
    reset();
    setMessage('Dépense ajoutée en attente. Argent groupe inchangé.');
  }

  async function reimburseExpense(row: Expense) {
    setError('');
    setMessage('');
    const response = await fetch(`/api/expenses/${row.id}/reimburse`, { method: 'POST' });
    const payload = await response.json().catch(() => ({} as ExpensePayload));
    if (!response.ok || !payload.expense) {
      setError(payload.message ?? 'Remboursement impossible.');
      return;
    }
    setPendingExpenses((rows) => rows.filter((entry) => entry.id !== row.id));
    setReimbursedExpenses((rows) => [payload.expense as Expense, ...rows]);
    setExpenseStatsRows((rows) => rows.map((entry) => entry.id === row.id ? payload.expense as Expense : entry));
    if (typeof payload.cashAfter === 'number') setGroupCash(payload.cashAfter);
    setMessage('Dépense remboursée. Argent groupe mis à jour.');
  }

  async function cancelExpense(row: Expense) {
    setError('');
    setMessage('');
    const response = await fetch(`/api/expenses/${row.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({} as ExpensePayload));
    if (!response.ok || !payload.expense) {
      setError(payload.message ?? 'Annulation impossible.');
      return;
    }
    setPendingExpenses((rows) => rows.filter((entry) => entry.id !== row.id));
    setExpenseStatsRows((rows) => rows.map((entry) => entry.id === row.id ? payload.expense as Expense : entry));
    setMessage('Dépense annulée.');
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          {props.canActivities ? <PageButton active={page === 'activities'} onClick={() => setPage('activities')}><SmallIcon name="activity" />Activités</PageButton> : null}
          {props.canPayroll ? <PageButton active={page === 'payroll'} onClick={() => setPage('payroll')}><SmallIcon name="payroll" />Payes</PageButton> : null}
          {props.canExpenses ? <PageButton active={page === 'expenses'} onClick={() => setPage('expenses')}><SmallIcon name="expense" />Dépenses</PageButton> : null}
        </div>
      </section>

      {message ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {page === 'activities' && props.canActivities ? (
        <ActivitiesPage
          cards={activityCards}
          activities={filteredActivities}
          members={props.members}
          modules={modules}
          memberFilter={memberFilter}
          moduleFilter={moduleFilter}
          periodFilter={periodFilter}
          setMemberFilter={setMemberFilter}
          setModuleFilter={setModuleFilter}
          setPeriodFilter={setPeriodFilter}
        />
      ) : null}

      {page === 'payroll' && props.canPayroll ? (
        <PayrollPage
          groupCash={groupCash}
          selectedPreview={effectivePreview}
          previousPreview={previousPreview}
          paidMembers={paidMembers}
          paidTotal={paidTotal}
          remainingPayroll={remainingPayroll}
          periodMode={periodMode}
          customStart={customStart}
          customEnd={customEnd}
          excludedIds={excludedIds}
          reportedIds={reportedIds}
          history={history}
          logs={logs}
          canPay={props.canPay}
          canAdjust={props.canAdjust}
          canReport={props.canReport}
          canExclude={props.canExclude}
          canLogs={props.canLogs}
          setCustomStart={setCustomStart}
          setCustomEnd={setCustomEnd}
          loadPeriod={loadPeriod}
          payrollAction={payrollAction}
        />
      ) : null}

      {page === 'expenses' && props.canExpenses ? (
        <ExpensesPage
          members={props.members}
          groupCash={groupCash}
          pending={pendingExpenses}
          reimbursed={reimbursedExpenses}
          statsRows={expenseStatsRows}
          logs={logs}
          canCreate={props.canExpenseCreate}
          canReimburse={props.canExpenseReimburse}
          canCancel={props.canExpenseCancel}
          canLogs={props.canLogs}
          onCreate={createExpense}
          onReimburse={reimburseExpense}
          onCancel={cancelExpense}
        />
      ) : null}
    </div>
  );
}

function ActivitiesPage(props: {
  cards: Array<{ member: MemberSummary; money: number; actions: number; participation: number; last: string | null; modules: Record<string, { count: number; money: number }>; recent: MemberActivityRow[] }>;
  activities: MemberActivityRow[];
  members: MemberSummary[];
  modules: Array<{ value: string; label: string }>;
  memberFilter: string;
  moduleFilter: string;
  periodFilter: 'all' | 'current' | 'previous';
  setMemberFilter: (value: string) => void;
  setModuleFilter: (value: string) => void;
  setPeriodFilter: (value: 'all' | 'current' | 'previous') => void;
}) {
  const cardModules = props.moduleFilter === 'Jobs' ? JOB_MODULES : props.moduleFilter !== 'all' ? [props.moduleFilter] : MODULE_ORDER;
  return (
    <div className="space-y-4">
      <section className="glass-card p-4">
        <div className="grid gap-2 md:grid-cols-3">
          <select className="saas-input !h-10" value={props.memberFilter} onChange={(event) => props.setMemberFilter(event.target.value)}>
            <option value="all">Tous les membres</option>
            {props.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
          </select>
          <select className="saas-input !h-10" value={props.periodFilter} onChange={(event) => props.setPeriodFilter(event.target.value as 'all' | 'current' | 'previous')}>
            <option value="current">Période active</option>
            <option value="previous">Semaine passée</option>
            <option value="all">Tout</option>
          </select>
          <select className="saas-input !h-10" value={props.moduleFilter} onChange={(event) => props.setModuleFilter(event.target.value)}>
            <option value="all">Tous les modules</option>
            {props.modules.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
          </select>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {props.cards.map((card) => (
          <article key={card.member.id} className="glass-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#fff1dd]">{card.member.name || card.member.username}</h3>
                <p className="text-xs text-[#efcdab]">Dernière activité: {card.last ? new Date(card.last).toLocaleString('fr-FR') : '-'}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right text-xs">
                <Mini label="Argent" value={formatUsd(card.money)} icon="money" />
                <Mini label="Actions" value={String(card.actions)} icon="actions" />
                <Mini label="Participations" value={card.participation.toFixed(1)} icon="activity" />
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {cardModules.map((module) => {
                const row = card.modules[module];
                return (
                  <div key={module} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]">
                    <p className="inline-flex items-center gap-2 font-semibold text-[#ffe8ca]"><SmallIcon name={moduleIcon(module)} className="h-4 w-4" />{module}</p>
                    <p>{row?.count ?? 0} action(s)</p>
                    <p>{formatUsd(row?.money ?? 0)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-1">
              {card.recent.map((row) => <p key={row.id} className="flex items-center gap-2 truncate text-xs text-[#d9b48f]"><SmallIcon name={moduleIcon(row.module)} className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{new Date(row.date).toLocaleString('fr-FR')} - {row.module} - {row.action} - {row.details}</span></p>)}
            </div>
          </article>
        ))}
        {props.cards.length === 0 ? <article className="glass-card p-4 text-sm text-[#efcdab]">Aucune activité sur ces filtres.</article> : null}
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">Historique activités</h3>
        <div className="mt-2 max-h-[420px] space-y-2 overflow-auto pr-1">
          {props.activities.slice(0, 80).map((row) => (
            <article key={row.id} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]">
              <div className="flex flex-wrap justify-between gap-2"><b className="text-[#ffe8ca]">{row.memberLabels.join(' + ') || '-'}</b><span>{new Date(row.date).toLocaleString('fr-FR')}</span></div>
              <p className="inline-flex items-center gap-2"><SmallIcon name={moduleIcon(row.module)} className="h-4 w-4" />{row.module} - {row.action} - {formatUsd(row.moneyGenerated)} - {row.details}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PayrollPage(props: {
  groupCash: number;
  selectedPreview: PayrollPreview;
  previousPreview: PayrollPreview;
  paidMembers: Record<string, number>;
  paidTotal: number;
  remainingPayroll: number;
  periodMode: PeriodMode;
  customStart: string;
  customEnd: string;
  excludedIds: string[];
  reportedIds: string[];
  history: HistoryPayment[];
  logs: LogRow[];
  canPay: boolean;
  canAdjust: boolean;
  canReport: boolean;
  canExclude: boolean;
  canLogs: boolean;
  setCustomStart: (value: string) => void;
  setCustomEnd: (value: string) => void;
  loadPeriod: (mode: PeriodMode, start?: string, end?: string) => Promise<void>;
  payrollAction: (action: 'pay' | 'adjust' | 'exclude' | 'report', row: PayrollMemberRow, enabled?: boolean) => Promise<void>;
}) {
  const lastPayments = useMemo(() => {
    const map = new Map<string, HistoryPayment>();
    for (const row of props.history) {
      if (!row.member_user_id) continue;
      const current = map.get(row.member_user_id);
      if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) map.set(row.member_user_id, row);
    }
    return map;
  }, [props.history]);

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Argent groupe" value={formatUsd(props.groupCash)} icon="money" />
        <Metric label="Total à payer" value={formatUsd(props.selectedPreview.totalProposed)} icon="payroll" />
        <Metric label="Déjà payé" value={formatUsd(props.paidTotal)} icon="paid" />
        <Metric label="Restant" value={formatUsd(props.remainingPayroll)} icon="pending" />
        <Metric label="Solde après payes" value={formatUsd(props.groupCash - props.remainingPayroll)} icon="money" />
        <Metric label="Période" value={`${props.selectedPreview.weekStartIso.slice(5, 10)} / ${props.selectedPreview.weekEndIso.slice(5, 10)}`} />
      </section>

      <section className="glass-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#fff1dd]">Période & comparaison</h3>
            <p className="mt-1 text-xs text-[#efcdab]">Active: {props.selectedPreview.weekStartIso.slice(0, 10)} - {props.selectedPreview.weekEndIso.slice(0, 10)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PageButton active={props.periodMode === 'current'} onClick={() => void props.loadPeriod('current')}>Active</PageButton>
            <PageButton active={props.periodMode === 'previous'} onClick={() => void props.loadPeriod('previous')}>Semaine passée</PageButton>
            <PageButton active={props.periodMode === 'custom'} onClick={() => void props.loadPeriod('custom')}>Custom</PageButton>
          </div>
        </div>
        {props.periodMode === 'custom' ? (
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input className="saas-input" type="datetime-local" value={props.customStart} onChange={(event) => props.setCustomStart(event.target.value)} />
            <input className="saas-input" type="datetime-local" value={props.customEnd} onChange={(event) => props.setCustomEnd(event.target.value)} />
            <button className="saas-primary-btn" onClick={() => void props.loadPeriod('custom', props.customStart, props.customEnd)}>Appliquer</button>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Compare title="Période active" preview={props.selectedPreview} paid={props.paidTotal} remaining={props.remainingPayroll} />
          <Compare title="Semaine passée" preview={props.previousPreview} paid={0} remaining={props.previousPreview.totalProposed} />
        </div>
      </section>

      <section className="space-y-2">
        {props.selectedPreview.members.map((member) => {
          const isPaid = Boolean(props.paidMembers[member.memberId]);
          const isExcluded = props.excludedIds.includes(member.memberId);
          const isReported = props.reportedIds.includes(member.memberId);
          const status = isPaid ? 'Payé' : isExcluded ? 'Exclu' : isReported ? 'Reporté' : member.eligible ? 'À payer' : 'Exclu';
          const lastPayment = lastPayments.get(member.memberId);
          return (
            <article key={member.memberId} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
              <div className="grid gap-3 xl:grid-cols-[1.2fr_140px_repeat(5,minmax(0,1fr))_300px] xl:items-center">
                <div>
                  <p className="text-base font-semibold text-[#fff1dd]">{member.memberLabel}</p>
                  <p>{member.reason}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[#f3d0aa]"><SmallIcon name="payroll" className="h-3.5 w-3.5" />Dernière paye : {lastPayment ? `${new Date(lastPayment.created_at).toLocaleDateString('fr-FR')} — ${formatUsd(lastPayment.amount)}` : 'aucune'}</p>
                </div>
                <StatusBadge status={status} />
                <Mini label="Argent" value={formatUsd(member.moneyContribution)} icon="money" />
                <Mini label="Actions" value={String(member.activityCount)} icon="actions" />
                <Mini label="Implication" value={String(member.participationCount)} />
                <Mini label="Score" value={member.totalScore.toFixed(2)} icon="score" />
                <Mini label="Paye proposée" value={formatUsd(member.proposedPay)} />
                <div className="flex flex-wrap justify-end gap-2">
                  {props.canPay ? <button className="saas-primary-btn !h-9 px-3" disabled={isPaid || isExcluded || isReported || !member.eligible || member.proposedPay <= 0} onClick={() => void props.payrollAction('pay', member)}>Payer</button> : null}
                  {props.canAdjust ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('adjust', member)}>Ajuster</button> : null}
                  {props.canReport ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('report', member, !isReported)}>{isReported ? 'Reprendre' : 'Reporter'}</button> : null}
                  {props.canExclude ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('exclude', member, !isExcluded)}>{isExcluded ? 'Réintégrer' : 'Exclure'}</button> : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <History title="Historique payes" rows={props.history.map((row) => ({ id: `pay-${row.id}`, date: row.created_at, text: `${row.member_label} - ${formatUsd(row.amount)} - ${formatUsd(row.group_balance_before)} -> ${formatUsd(row.group_balance_after)}` }))} />
        {props.canLogs ? <LogList title="Logs payes" rows={props.logs.filter((row) => row.action.includes('payroll')).slice(0, 40)} /> : null}
      </section>
    </div>
  );
}

type ExpenseFormState = { memberId: string; label: string; amount: string; category: string; note: string; proofUrl: string };

function ExpensesPage(props: {
  members: MemberSummary[];
  groupCash: number;
  pending: Expense[];
  reimbursed: Expense[];
  statsRows: Expense[];
  logs: LogRow[];
  canCreate: boolean;
  canReimburse: boolean;
  canCancel: boolean;
  canLogs: boolean;
  onCreate: (form: ExpenseFormState, reset: () => void) => Promise<void>;
  onReimburse: (row: Expense) => Promise<void>;
  onCancel: (row: Expense) => Promise<void>;
}) {
  const [form, setForm] = useState<ExpenseFormState>({ memberId: props.members[0]?.id ?? '', label: '', amount: '', category: 'Achat stock', note: '', proofUrl: '' });
  const allRows = useMemo(() => props.statsRows.length ? props.statsRows : [...props.pending, ...props.reimbursed], [props.pending, props.reimbursed, props.statsRows]);
  const totals = useMemo(() => ({
    pending: props.pending.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    reimbursed: props.reimbursed.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  }), [props.pending, props.reimbursed]);
  const byCategory = useMemo(() => groupExpenses(allRows, (row) => row.category), [allRows]);
  const byMember = useMemo(() => groupExpenses(allRows, (row) => row.member_name), [allRows]);
  const reset = () => setForm({ memberId: props.members[0]?.id ?? '', label: '', amount: '', category: 'Achat stock', note: '', proofUrl: '' });

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Metric label="Total en attente" value={formatUsd(totals.pending)} icon="pending" />
        <Metric label="Total remboursé" value={formatUsd(totals.reimbursed)} icon="paid" />
        <Metric label="Argent groupe" value={formatUsd(props.groupCash)} icon="money" />
        <Metric label="Dépenses" value={String(allRows.length)} icon="expense" />
      </section>

      {props.canCreate ? (
        <section className="glass-card p-4">
          <h3 className="text-sm font-semibold text-[#fff1dd]">Nouvelle dépense</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Membre" icon="member"><select className="saas-input" value={form.memberId} onChange={(event) => setForm((cur) => ({ ...cur, memberId: event.target.value }))}>{props.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}</select></Field>
            <Field label="Catégorie" icon="category"><select className="saas-input" value={form.category} onChange={(event) => setForm((cur) => ({ ...cur, category: event.target.value }))}>{CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></Field>
            <Field label="Libellé"><input className="saas-input" value={form.label} onChange={(event) => setForm((cur) => ({ ...cur, label: event.target.value }))} /></Field>
            <Field label="Montant" icon="amount"><input className="saas-input" value={form.amount} onChange={(event) => setForm((cur) => ({ ...cur, amount: event.target.value }))} inputMode="decimal" /></Field>
            <Field label="Preuve optionnelle"><input className="saas-input" value={form.proofUrl} onChange={(event) => setForm((cur) => ({ ...cur, proofUrl: event.target.value }))} /></Field>
            <Field label="Note optionnelle"><input className="saas-input" value={form.note} onChange={(event) => setForm((cur) => ({ ...cur, note: event.target.value }))} /></Field>
          </div>
          <button className="saas-primary-btn mt-4" disabled={!form.memberId || !form.label.trim() || Number(form.amount) <= 0} onClick={() => void props.onCreate(form, reset)}>Créer la dépense</button>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <ExpenseList title="Dépenses en attente" icon="pending" rows={props.pending} empty="Aucune dépense en attente." actions={(row) => (
          <>
            {props.canReimburse ? <button className="saas-primary-btn !h-9 px-3 text-xs" onClick={() => void props.onReimburse(row)}>Rembourser</button> : null}
            {props.canCancel ? <button className="saas-ghost-btn !h-9 px-3 text-xs" onClick={() => void props.onCancel(row)}>Annuler</button> : null}
          </>
        )} />
        <ExpenseList title="Dépenses remboursées" icon="paid" rows={props.reimbursed} empty="Aucune dépense remboursée." />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <StatsBlock title="Dépenses par membre" icon="member" rows={byMember} />
        <StatsBlock title="Dépenses par catégorie" icon="category" rows={byCategory} />
      </section>

      {props.canLogs ? <LogList title="Logs récents" rows={props.logs.filter((row) => row.action.includes('expense')).slice(0, 60)} /> : null}
    </div>
  );
}

function recomputePreview(preview: PayrollPreview, excludedIds: string[], adjustments: Record<string, number>) {
  const excluded = new Set(excludedIds);
  const members = preview.members.map((row) => {
    if (excluded.has(row.memberId)) return { ...row, eligible: false, proposedPay: 0, reason: 'Exclu manuellement' };
    const manual = adjustments[row.memberId];
    return Number.isFinite(manual) && manual >= 0 ? { ...row, proposedPay: Math.round(manual) } : row;
  });
  const totalProposed = members.reduce((sum, row) => sum + (row.eligible ? Number(row.proposedPay ?? 0) : 0), 0);
  return { ...preview, members, totalProposed, balanceAfter: preview.balance - totalProposed, eligibleCount: members.filter((row) => row.eligible).length, ineligibleCount: members.filter((row) => !row.eligible).length };
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

type IconName = 'activity' | 'payroll' | 'expense' | 'tablet' | 'cigarette' | 'processor' | 'drugs' | 'robbery' | 'four' | 'sale' | 'cargo' | 'gofast' | 'money' | 'actions' | 'score' | 'pending' | 'paid' | 'reported' | 'excluded' | 'category' | 'member' | 'amount' | 'jobs';

function SmallIcon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconShape(name)}
    </svg>
  );
}

function iconShape(name: IconName) {
  switch (name) {
    case 'activity': return <><path d="M4 12h4l2-5 4 10 2-5h4" /><path d="M4 19h16" /></>;
    case 'payroll': return <><path d="M4 7h16v10H4z" /><path d="M8 11h.01" /><path d="M16 13h.01" /><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></>;
    case 'expense': return <><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h3" /></>;
    case 'tablet': return <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M11 17h2" /></>;
    case 'cigarette': return <><path d="M4 15h10" /><path d="M16 15h4" /><path d="M8 11c1-1 1-2 0-3" /><path d="M12 11c1-1 1-2 0-3" /></>;
    case 'processor': return <><circle cx="12" cy="12" r="3" /><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m18.4 5.6-2.1 2.1" /><path d="m7.7 16.3-2.1 2.1" /></>;
    case 'drugs': return <><path d="M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" /><path d="M8 3h8" /><path d="M8 15h8" /></>;
    case 'robbery': return <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="M9 12h6" /></>;
    case 'four': return <><path d="M12 21c4-2 6-5 6-8 0-3-2-5-4-7 0 3-2 4-2 4s-2-2-1-6c-3 2-5 5-5 9 0 3 2 6 6 8z" /></>;
    case 'sale': return <><path d="M20 12 12 20 4 12V4h8z" /><path d="M8 8h.01" /></>;
    case 'cargo': return <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></>;
    case 'gofast': return <><path d="M5 16h14l-2-5H7z" /><path d="M7 11l2-3h6l2 3" /><circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="18" r="1.5" /></>;
    case 'money': return <><path d="M4 7h16v10H4z" /><path d="M8 12h.01" /><path d="M16 12h.01" /><circle cx="12" cy="12" r="2.5" /></>;
    case 'actions': return <><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></>;
    case 'score': return <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z" /></>;
    case 'pending': return <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>;
    case 'paid': return <><circle cx="12" cy="12" r="8" /><path d="m8.5 12.5 2.2 2.2 4.8-5" /></>;
    case 'reported': return <><path d="M9 5v14" /><path d="M15 5v14" /></>;
    case 'excluded': return <><circle cx="12" cy="12" r="8" /><path d="m8 8 8 8" /></>;
    case 'category': return <><path d="M20 12 12 20 4 12V4h8z" /><path d="M8 8h.01" /></>;
    case 'member': return <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>;
    case 'amount': return <><path d="M12 3v18" /><path d="M17 7.5A4 4 0 0 0 12 6c-3 0-5 1.2-5 3s2 2.7 5 3 5 1.2 5 3-2 3-5 3a5 5 0 0 1-5-2" /></>;
    case 'jobs': return <><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" /><path d="M4 7h16v12H4z" /><path d="M9 12h6" /></>;
  }
}

function moduleIcon(module: string): IconName {
  if (module === 'Jobs') return 'jobs';
  if (module === 'Jobs Tablette') return 'tablet';
  if (module === 'Jobs Cigarette') return 'cigarette';
  if (module === 'Jobs Processeur' || module === 'Processeur') return 'processor';
  if (module === 'Drogues') return 'drugs';
  if (module === 'Braquage') return 'robbery';
  if (module === 'FOUR') return 'four';
  if (module === 'Vente objets') return 'sale';
  if (module === 'Cargo') return 'cargo';
  if (module === 'GoFast') return 'gofast';
  return 'activity';
}

function statusIcon(status: string): IconName {
  if (status === 'Payé') return 'paid';
  if (status === 'À payer') return 'pending';
  if (status === 'Reporté') return 'reported';
  return 'excluded';
}

function PageButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`filter-pill inline-flex items-center gap-2 ${active ? 'filter-pill-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">{icon ? <p className="inline-flex items-center gap-2 text-xs text-[#efcdab]"><SmallIcon name={icon} className="h-4 w-4" />{label}</p> : <p className="text-xs text-[#efcdab]">{label}</p>}<p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function Mini({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return <div>{icon ? <p className="mb-1 inline-flex items-center gap-1 text-[11px] text-[#efcdab]"><SmallIcon name={icon} className="h-3.5 w-3.5" />{label}</p> : <p className="text-[11px] text-[#efcdab]">{label}</p>}<p className="font-semibold text-[#ffe8ca]">{value}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'Payé'
    ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100'
    : status === 'À payer'
      ? 'border-amber-300/45 bg-amber-500/15 text-amber-100'
      : status === 'Reporté'
        ? 'border-sky-300/35 bg-sky-500/15 text-sky-100'
        : 'border-red-300/30 bg-red-500/10 text-red-100';
  return <div className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold ${style}`}><SmallIcon name={statusIcon(status)} />{status}</div>;
}

function Compare({ title, preview, paid, remaining }: { title: string; preview: PayrollPreview; paid: number; remaining: number }) {
  return <article className="rounded-lg border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><p className="font-semibold text-[#ffe8ca]">{title}</p><p>{preview.weekStartIso.slice(0, 10)} - {preview.weekEndIso.slice(0, 10)}</p><p>Éligibles: {preview.eligibleCount} · Enveloppe: {formatUsd(preview.envelope)} · Payé: {formatUsd(paid)} · Restant: {formatUsd(remaining)}</p></article>;
}

function History({ title, rows }: { title: string; rows: Array<{ id: string; date: string; text: string }> }) {
  return <section className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">{title}</h3><div className="mt-2 max-h-[360px] space-y-2 overflow-auto pr-1">{rows.map((row) => <article key={row.id} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]"><p className="text-[#ffe8ca]">{row.text}</p><p>{new Date(row.date).toLocaleString('fr-FR')}</p></article>)}{rows.length === 0 ? <p className="text-sm text-[#efcdab]">Aucun historique.</p> : null}</div></section>;
}

function LogList({ title, rows }: { title: string; rows: LogRow[] }) {
  return <section className="glass-card p-4"><h3 className="text-sm font-semibold text-[#fff1dd]">{title}</h3><div className="mt-2 max-h-[360px] space-y-2 overflow-auto pr-1">{rows.map((row) => <article key={row.id} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]"><div className="flex flex-wrap justify-between gap-2"><b className="text-[#ffe8ca]">{row.action}</b><span>{new Date(row.created_at).toLocaleString('fr-FR')}</span></div><p>{row.summary}</p><p>Utilisateur: {row.actor_name || '-'}</p></article>)}{rows.length === 0 ? <p className="text-sm text-[#efcdab]">Aucun log.</p> : null}</div></section>;
}

function Field({ label, children, icon }: { label: string; children: ReactNode; icon?: IconName }) {
  return <label className="block text-xs text-[#efcdab]"><span className="mb-1 inline-flex items-center gap-1">{icon ? <SmallIcon name={icon} className="h-3.5 w-3.5" /> : null}{label}</span>{children}</label>;
}

function ExpenseList({ title, icon, rows, empty, actions }: { title: string; icon?: IconName; rows: Expense[]; empty: string; actions?: (row: Expense) => ReactNode }) {
  return <section className="glass-card p-4"><h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#fff1dd]">{icon ? <SmallIcon name={icon} /> : null}{title}</h3><div className="mt-2 space-y-2">{rows.map((row) => <article key={row.id} className="rounded-lg border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="flex flex-wrap items-start justify-between gap-3"><CompactExpense row={row} />{actions ? <div className="flex flex-wrap gap-2">{actions(row)}</div> : null}</div></article>)}{rows.length === 0 ? <p className="text-sm text-[#efcdab]">{empty}</p> : null}</div></section>;
}

function CompactExpense({ row }: { row: Expense }) {
  const statusLabel = row.status === 'pending' ? 'En attente' : row.status === 'reimbursed' ? 'Remboursée' : 'Annulée';
  return <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1"><SmallIcon name="category" className="h-3.5 w-3.5" />{row.category}</span><span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1"><SmallIcon name={row.status === 'pending' ? 'pending' : row.status === 'reimbursed' ? 'paid' : 'excluded'} className="h-3.5 w-3.5" />{statusLabel}</span></div><p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#ffe8ca]"><SmallIcon name="member" className="h-4 w-4" />{row.member_name} - {row.label}</p><p className="inline-flex items-center gap-2 text-base font-semibold text-[#fff1dd]"><SmallIcon name="amount" className="h-4 w-4" />{formatUsd(row.amount)}</p><p>Créée le {new Date(row.created_at).toLocaleString('fr-FR')}{row.reimbursed_at ? ` · Remboursée le ${new Date(row.reimbursed_at).toLocaleString('fr-FR')}` : ''}</p>{row.reimbursed_by_name ? <p>Remboursé par {row.reimbursed_by_name}</p> : null}{row.money_before != null && row.money_after != null ? <p>Argent groupe: {formatUsd(row.money_before)} vers {formatUsd(row.money_after)}</p> : null}{row.note ? <p className="mt-1 text-[#d9b48f]">{row.note}</p> : null}{row.proof_url ? <a className="mt-1 inline-block underline" href={row.proof_url} target="_blank" rel="noreferrer">Voir preuve</a> : null}</div>;
}

function StatsBlock({ title, icon, rows }: { title: string; icon?: IconName; rows: Array<{ label: string; count: number; pending: number; reimbursed: number; total: number }> }) {
  return <article className="glass-card p-4"><h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#fff1dd]">{icon ? <SmallIcon name={icon} /> : null}{title}</h3><div className="mt-2 space-y-2">{rows.map((row) => <div key={row.label} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]"><div className="flex justify-between gap-2"><b className="text-[#ffe8ca]">{row.label}</b><span>{row.count}</span></div><p>En attente {formatUsd(row.pending)} · Remboursé {formatUsd(row.reimbursed)}</p></div>)}{rows.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune donnée.</p> : null}</div></article>;
}
