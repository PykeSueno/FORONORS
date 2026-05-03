'use client';

import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { formatUsd } from '@/lib/currency';
import type { PayrollConfig, PayrollMemberRow, PayrollPreview } from '@/lib/payroll';
import type { MemberActivityRow } from '@/lib/payroll-service';

type Tab = 'global' | 'activities' | 'payroll' | 'history' | 'logs';
type PeriodMode = 'current' | 'previous' | 'custom';
type MemberSummary = { id: string; name: string; username: string; isActive: boolean; moneyGenerated: number; activityCount: number; proposedPay: number; lastActivity: string | null };
type HistoryPayment = { id: number; week_start: string; week_end: string; member_user_id: string | null; member_label: string; amount: number; paid_by: string | null; group_balance_before: number; group_balance_after: number; created_at: string };
type LogRow = { id: number; action: string; summary: string; actor_name: string | null; entity_id: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };

type ApiPayload = {
  selected?: PayrollPreview;
  previous?: PayrollPreview;
  state?: { paid: Record<string, number>; adjustments: Record<string, number>; excluded: string[] };
  paid?: Record<string, number>;
  adjustments?: Record<string, number>;
  excluded?: string[];
  history?: HistoryPayment[];
  logs?: LogRow[];
  config?: PayrollConfig;
  message?: string;
};

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
  history: HistoryPayment[];
  logs: LogRow[];
  canActivities: boolean;
  canPayroll: boolean;
  canConfigure: boolean;
  canPay: boolean;
  canAdjust: boolean;
  canExclude: boolean;
  canHistory: boolean;
  canLogs: boolean;
};

export function ActivityPayrollHubClient(props: Props) {
  const [tab, setTab] = useState<Tab>('global');
  const [memberFilter, setMemberFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [activityPeriodFilter, setActivityPeriodFilter] = useState<'all' | 'current' | 'previous'>('current');
  const [dateFilter, setDateFilter] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [customStart, setCustomStart] = useState(props.customDefaultStart.slice(0, 16));
  const [customEnd, setCustomEnd] = useState(props.customDefaultEnd.slice(0, 16));
  const [selectedPreview, setSelectedPreview] = useState<PayrollPreview>(props.currentPreview);
  const [previousPreview, setPreviousPreview] = useState<PayrollPreview>(props.previousPreview);
  const [config, setConfig] = useState<PayrollConfig>(props.currentPreview.config);
  const [paidMembers, setPaidMembers] = useState(props.initialPaidMembers);
  const [adjustments, setAdjustments] = useState(props.initialAdjustments);
  const [excludedIds, setExcludedIds] = useState(props.initialExcludedIds);
  const [history, setHistory] = useState(props.history);
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
  const overviewTotals = useMemo(() => ({
    money: props.members.reduce((sum, member) => sum + member.moneyGenerated, 0),
    activities: props.members.reduce((sum, member) => sum + member.activityCount, 0),
    payroll: effectivePreview.totalProposed,
    paid: paidTotal
  }), [effectivePreview.totalProposed, paidTotal, props.members]);

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
    if (payload.history) setHistory(payload.history);
    if (payload.logs) setLogs(payload.logs);
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

  async function payrollAction(action: 'pay' | 'adjust' | 'exclude', row: PayrollMemberRow, enabled = true) {
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
    if (payload.paid) setPaidMembers(payload.paid);
    if (payload.adjustments) setAdjustments(payload.adjustments);
    if (payload.excluded) setExcludedIds(payload.excluded);
    await loadPeriod(periodMode, customStart, customEnd);
    setMessage(action === 'pay' ? 'Membre paye.' : action === 'adjust' ? 'Ajustement enregistre.' : enabled ? 'Membre exclu.' : 'Membre reinclus.');
  }

  function showMember(memberId: string) {
    setMemberFilter(memberId);
    setTab(props.canActivities ? 'activities' : 'global');
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Metric icon="💵" label="Argent genere" value={formatUsd(overviewTotals.money)} />
        <Metric icon="🎯" label="Activites" value={String(overviewTotals.activities)} />
        <Metric icon="🏦" label="Paye estimee" value={formatUsd(overviewTotals.payroll)} />
        <Metric icon="✅" label="Deja paye" value={formatUsd(overviewTotals.paid)} />
      </section>

      <section className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'global'} onClick={() => setTab('global')}>Vue globale</TabButton>
          {props.canActivities ? <TabButton active={tab === 'activities'} onClick={() => setTab('activities')}>Activites</TabButton> : null}
          {props.canPayroll ? <TabButton active={tab === 'payroll'} onClick={() => setTab('payroll')}>Payes</TabButton> : null}
          {props.canHistory ? <TabButton active={tab === 'history'} onClick={() => setTab('history')}>Historique</TabButton> : null}
          {props.canLogs ? <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</TabButton> : null}
        </div>
      </section>

      {message ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {tab === 'global' ? <GlobalView members={props.members} onDetail={showMember} /> : null}
      {tab === 'activities' && props.canActivities ? (
        <ActivitiesView
          activities={filteredActivities}
          dateFilter={dateFilter}
          memberFilter={memberFilter}
          members={props.members}
          moduleFilter={moduleFilter}
          modules={modules}
          periodFilter={activityPeriodFilter}
          setDateFilter={setDateFilter}
          setMemberFilter={setMemberFilter}
          setModuleFilter={setModuleFilter}
          setPeriodFilter={setActivityPeriodFilter}
        />
      ) : null}
      {tab === 'payroll' && props.canPayroll ? (
        <PayrollView
          adjustments={adjustments}
          canAdjust={props.canAdjust}
          canConfigure={props.canConfigure}
          canExclude={props.canExclude}
          canPay={props.canPay}
          config={config}
          customEnd={customEnd}
          customStart={customStart}
          effectivePreview={effectivePreview}
          excludedIds={excludedIds}
          loadPeriod={loadPeriod}
          paidMembers={paidMembers}
          paidTotal={paidTotal}
          payrollAction={payrollAction}
          periodMode={periodMode}
          previousPreview={previousPreview}
          saveConfig={saveConfig}
          saving={saving}
          selectedRange={selectedRange}
          setConfig={setConfig}
          setCustomEnd={setCustomEnd}
          setCustomStart={setCustomStart}
          updateAdjustment={(memberId, amount) => setAdjustments((cur) => ({ ...cur, [memberId]: Math.max(0, Math.round(amount)) }))}
        />
      ) : null}
      {tab === 'history' && props.canHistory ? <HistoryView rows={history} /> : null}
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
  return {
    ...preview,
    config: cfg,
    reserveKept,
    fundsAvailable,
    envelope,
    members: rows,
    totalProposed,
    balanceAfter: preview.balance - totalProposed,
    eligibleCount: rows.filter((row) => row.eligible).length,
    ineligibleCount: rows.filter((row) => !row.eligible).length
  };
}

function GlobalView({ members, onDetail }: { members: MemberSummary[]; onDetail: (memberId: string) => void }) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#fff1dd]">👤 Par membre</h2>
        <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{members.length} membres</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {members.map((member) => (
          <article key={member.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
            <div className="grid gap-3 sm:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_auto] sm:items-center">
              <div>
                <p className="font-semibold text-[#ffe8ca]">{member.name || member.username}</p>
                <p className="text-xs text-[#efcdab]">{member.isActive ? '🟢 Actif' : '⚪ Inactif'}</p>
              </div>
              <Mini label="Argent" value={formatUsd(member.moneyGenerated)} />
              <Mini label="Activites" value={String(member.activityCount)} />
              <Mini label="Paye" value={formatUsd(member.proposedPay)} />
              <Mini label="Derniere" value={member.lastActivity ? new Date(member.lastActivity).toLocaleDateString('fr-FR') : '-'} />
              <button className="saas-primary-btn !h-9 whitespace-nowrap px-3" onClick={() => onDetail(member.id)}>Voir detail</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivitiesView(props: {
  activities: MemberActivityRow[];
  members: MemberSummary[];
  modules: string[];
  memberFilter: string;
  moduleFilter: string;
  periodFilter: 'all' | 'current' | 'previous';
  dateFilter: string;
  setMemberFilter: (value: string) => void;
  setModuleFilter: (value: string) => void;
  setPeriodFilter: (value: 'all' | 'current' | 'previous') => void;
  setDateFilter: (value: string) => void;
}) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3 grid gap-2 lg:grid-cols-4">
        <select className="saas-input !h-10" value={props.memberFilter} onChange={(event) => props.setMemberFilter(event.target.value)}>
          <option value="all">Tous les membres</option>
          {props.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
        </select>
        <select className="saas-input !h-10" value={props.moduleFilter} onChange={(event) => props.setModuleFilter(event.target.value)}>
          <option value="all">Tous les modules</option>
          {props.modules.map((module) => <option key={module} value={module}>{module}</option>)}
        </select>
        <select className="saas-input !h-10" value={props.periodFilter} onChange={(event) => props.setPeriodFilter(event.target.value as 'all' | 'current' | 'previous')}>
          <option value="current">Semaine actuelle</option>
          <option value="previous">Semaine passee</option>
          <option value="all">Tout</option>
        </select>
        <input className="saas-input !h-10" type="date" value={props.dateFilter} onChange={(event) => props.setDateFilter(event.target.value)} />
      </div>
      <div className="max-h-[620px] overflow-auto pr-1">
        <table className="min-w-full text-left text-xs text-[#efcdab]">
          <thead className="sticky top-0 bg-[#2b1a12] text-[#ffe8ca]">
            <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Membre</th><th className="px-2 py-2">Module</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Argent</th><th className="px-2 py-2">Participation</th><th className="px-2 py-2">Details</th></tr>
          </thead>
          <tbody>
            {props.activities.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="whitespace-nowrap px-2 py-2">{new Date(row.date).toLocaleString('fr-FR')}</td>
                <td className="px-2 py-2 text-[#ffe8ca]">{row.memberLabels.join(', ') || '-'}</td>
                <td className="px-2 py-2">{row.module}</td>
                <td className="px-2 py-2">{row.action}</td>
                <td className="px-2 py-2 font-semibold text-[#ffe8ca]">{formatUsd(row.moneyGenerated)}</td>
                <td className="px-2 py-2">{row.participation}</td>
                <td className="px-2 py-2">{row.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {props.activities.length === 0 ? <p className="p-3 text-xs text-[#efcdab]">Aucune activite.</p> : null}
      </div>
    </section>
  );
}

function PayrollView(props: {
  canAdjust: boolean;
  canConfigure: boolean;
  canExclude: boolean;
  canPay: boolean;
  config: PayrollConfig;
  customEnd: string;
  customStart: string;
  effectivePreview: PayrollPreview;
  excludedIds: string[];
  paidMembers: Record<string, number>;
  paidTotal: number;
  periodMode: PeriodMode;
  previousPreview: PayrollPreview;
  saving: boolean;
  selectedRange: { startIso: string; endIso: string };
  setConfig: Dispatch<SetStateAction<PayrollConfig>>;
  setCustomEnd: (value: string) => void;
  setCustomStart: (value: string) => void;
  adjustments: Record<string, number>;
  updateAdjustment: (memberId: string, amount: number) => void;
  loadPeriod: (mode: PeriodMode, start?: string, end?: string) => Promise<void>;
  payrollAction: (action: 'pay' | 'adjust' | 'exclude', row: PayrollMemberRow, enabled?: boolean) => Promise<void>;
  saveConfig: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <section className="grid gap-2 lg:grid-cols-6">
        <Metric icon="💳" label="Argent groupe" value={formatUsd(props.effectivePreview.balance)} />
        <Metric icon="🛡️" label="Reserve" value={formatUsd(props.effectivePreview.reserveKept)} />
        <Metric icon="📦" label="Enveloppe" value={formatUsd(props.effectivePreview.envelope)} />
        <Metric icon="✅" label="Calcule" value={formatUsd(props.effectivePreview.totalProposed)} />
        <Metric icon="🏦" label="Apres paye" value={formatUsd(props.effectivePreview.balance - props.paidTotal)} />
        <Metric icon="👥" label="Eligibles" value={String(props.effectivePreview.eligibleCount)} />
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">📆 Periode de calcul</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={`filter-pill ${props.periodMode === 'current' ? 'filter-pill-active' : ''}`} onClick={() => void props.loadPeriod('current')}>Semaine actuelle</button>
          <button className={`filter-pill ${props.periodMode === 'previous' ? 'filter-pill-active' : ''}`} onClick={() => void props.loadPeriod('previous')}>Semaine passee</button>
          <button className={`filter-pill ${props.periodMode === 'custom' ? 'filter-pill-active' : ''}`} onClick={() => void props.loadPeriod('custom')}>Personnalisee</button>
        </div>
        {props.periodMode === 'custom' ? (
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input className="saas-input" type="datetime-local" value={props.customStart} onChange={(event) => props.setCustomStart(event.target.value)} />
            <input className="saas-input" type="datetime-local" value={props.customEnd} onChange={(event) => props.setCustomEnd(event.target.value)} />
            <button className="saas-primary-btn" onClick={() => void props.loadPeriod('custom', props.customStart, props.customEnd)}>Appliquer</button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[#efcdab]">Active: {props.selectedRange.startIso.slice(0, 10)} → {props.selectedRange.endIso.slice(0, 10)} · Exclusions: {props.excludedIds.length}</p>
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">📊 Comparaison</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <CompareCard title="Periode active" preview={props.effectivePreview} />
          <CompareCard title="Semaine passee" preview={props.previousPreview} />
        </div>
      </section>

      {props.canConfigure ? <Settings config={props.config} saving={props.saving} setConfig={props.setConfig} saveConfig={props.saveConfig} /> : null}

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">💸 Payes membres</h3>
        <div className="mt-2 max-h-[560px] space-y-2 overflow-auto pr-1">
          {props.effectivePreview.members.map((member) => {
            const isPaid = Boolean(props.paidMembers[member.memberId]);
            const isExcluded = props.excludedIds.includes(member.memberId);
            return (
              <article key={member.memberId} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
                <div className="grid gap-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_320px] xl:items-center">
                  <div><p className="font-semibold text-[#ffe8ca]">{member.memberLabel}</p><p>{isPaid ? 'Paye' : isExcluded ? 'Exclu' : member.eligible ? 'A payer' : member.reason}</p></div>
                  <Mini label="Argent" value={formatUsd(member.moneyContribution)} />
                  <Mini label="Actions" value={String(member.activityCount)} />
                  <Mini label="Implication" value={String(member.participationCount)} />
                  <Mini label="Score" value={member.totalScore.toFixed(2)} />
                  <Mini label="Paye" value={formatUsd(member.proposedPay)} />
                  <div className="flex flex-wrap justify-end gap-2">
                    {props.canAdjust ? <input className="saas-input !h-9 w-24" value={props.adjustments[member.memberId] ?? ''} placeholder="Ajuster" onChange={(event) => props.updateAdjustment(member.memberId, Number(event.target.value || 0))} /> : null}
                    {props.canAdjust ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('adjust', member)}>Ajuster</button> : null}
                    {props.canExclude ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void props.payrollAction('exclude', member, !isExcluded)}>{isExcluded ? 'Reinclure' : 'Exclure'}</button> : null}
                    {props.canPay ? <button className="saas-primary-btn !h-9 px-3" disabled={isPaid || isExcluded || !member.eligible || member.proposedPay <= 0} onClick={() => void props.payrollAction('pay', member)}>{isPaid ? 'Paye' : 'Payer'}</button> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Settings({ config, saving, setConfig, saveConfig }: { config: PayrollConfig; saving: boolean; setConfig: Dispatch<SetStateAction<PayrollConfig>>; saveConfig: () => Promise<void> }) {
  return (
    <section className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-semibold text-[#fff1dd]">⚙️ Reglages paye</h3>
      <div className="grid gap-2 md:grid-cols-4">
        <Field label="Reserve minimale" value={config.reserveMinimum} onChange={(v) => setConfig((cur) => ({ ...cur, reserveMinimum: v }))} />
        <Field label="% distribuable" value={Math.round(config.distributablePercent * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, distributablePercent: Math.max(0, Math.min(100, v)) / 100 }))} />
        <Field label="Plafond membre" value={config.memberCap} onChange={(v) => setConfig((cur) => ({ ...cur, memberCap: v }))} />
        <Field label="Minimum membre" value={config.memberMinimum} onChange={(v) => setConfig((cur) => ({ ...cur, memberMinimum: v }))} />
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <Field label="Poids argent (%)" value={Math.round(config.weights.money * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, weights: { ...cur.weights, money: v / 100 } }))} />
        <Field label="Poids activite (%)" value={Math.round(config.weights.activity * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, weights: { ...cur.weights, activity: v / 100 } }))} />
        <Field label="Poids implication (%)" value={Math.round(config.weights.participation * 100)} onChange={(v) => setConfig((cur) => ({ ...cur, weights: { ...cur.weights, participation: v / 100 } }))} />
        <Field label="Seuil actions" value={config.minActions} onChange={(v) => setConfig((cur) => ({ ...cur, minActions: v }))} />
        <Field label="Seuil argent" value={config.minMoney} onChange={(v) => setConfig((cur) => ({ ...cur, minMoney: v }))} />
      </div>
      <button className="saas-primary-btn" disabled={saving} onClick={() => void saveConfig()}>{saving ? 'Enregistrement...' : 'Enregistrer les reglages'}</button>
    </section>
  );
}

function HistoryView({ rows }: { rows: HistoryPayment[] }) {
  return (
    <section className="glass-card p-4">
      <h2 className="mb-3 text-base font-semibold text-[#fff1dd]">📜 Historique des payes</h2>
      <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">{row.member_label} · {formatUsd(Number(row.amount ?? 0))}</p><p>{new Date(row.created_at).toLocaleString('fr-FR')}</p></div>
            <p>Periode: {row.week_start.slice(0, 10)} → {row.week_end.slice(0, 10)} · Solde: {formatUsd(Number(row.group_balance_before ?? 0))} → {formatUsd(Number(row.group_balance_after ?? 0))}</p>
          </article>
        ))}
        {rows.length === 0 ? <p className="text-xs text-[#efcdab]">Aucune paye versee.</p> : null}
      </div>
    </section>
  );
}

function LogsView({ rows }: { rows: LogRow[] }) {
  return (
    <section className="glass-card p-4">
      <h2 className="mb-3 text-base font-semibold text-[#fff1dd]">🧾 Logs paye</h2>
      <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">{row.action}</p><p>{new Date(row.created_at).toLocaleString('fr-FR')}</p></div>
            <p>{row.summary}</p>
            <p>Utilisateur: {row.actor_name || '-'}</p>
          </article>
        ))}
        {rows.length === 0 ? <p className="text-xs text-[#efcdab]">Aucun log.</p> : null}
      </div>
    </section>
  );
}

function CompareCard({ title, preview }: { title: string; preview: PayrollPreview }) {
  return <article className="rounded-xl border border-white/10 bg-[#3b2518]/60 p-3 text-xs text-[#efcdab]"><p className="font-semibold text-[#ffe8ca]">{title}</p><p>{preview.weekStartIso.slice(0, 10)} → {preview.weekEndIso.slice(0, 10)}</p><p>Eligibles: {preview.eligibleCount} · Enveloppe: {formatUsd(preview.envelope)} · Total: {formatUsd(preview.totalProposed)}</p></article>;
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-[#efcdab]">{label}</p><p className="font-semibold text-[#ffe8ca]">{value}</p></div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`filter-pill ${active ? 'filter-pill-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return <label className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-2 text-xs text-[#efcdab]"><span>{label}</span><input className="saas-input mt-1" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))} /></label>;
}
