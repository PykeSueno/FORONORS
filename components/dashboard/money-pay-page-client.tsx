'use client';

import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import type { PayrollPreview } from '@/lib/payroll';

type HistoryRun = {
  id: number;
  week_start: string;
  week_end: string;
  period_mode?: 'weekly' | 'custom';
  validated_at: string;
  validated_by_label: string | null;
  group_balance_before: number;
  group_balance_after: number;
  reserve_kept: number;
  envelope: number;
  total_distributed: number;
};

type HistoryRunMember = {
  id: number;
  payroll_run_id: number;
  member_user_id: string | null;
  member_label: string;
  amount: number;
  score_total: number;
  money_contribution: number;
  activity_count: number;
  participation_count: number;
};

type LogRow = { id: number; action: string; summary: string; created_at: string; actor_name: string | null };

export function MoneyPayPageClient({
  canConfigure,
  canAdjust,
  canValidate,
  canHistory,
  canLogs,
  currentPreview,
  previousPreview,
  customPreview,
  customDefaultStart,
  customDefaultEnd,
  initialExcludedIds,
  history,
  historyMembers,
  logs
}: {
  canConfigure: boolean;
  canAdjust: boolean;
  canValidate: boolean;
  canHistory: boolean;
  canLogs: boolean;
  currentPreview: PayrollPreview;
  previousPreview: PayrollPreview;
  customPreview: PayrollPreview;
  customDefaultStart: string;
  customDefaultEnd: string;
  initialExcludedIds: string[];
  history: HistoryRun[];
  historyMembers: HistoryRunMember[];
  logs: LogRow[];
}) {
  const [config, setConfig] = useState(currentPreview.config);
  const [periodMode, setPeriodMode] = useState<'current' | 'previous' | 'custom'>('current');
  const [customStart, setCustomStart] = useState(customDefaultStart.slice(0, 16));
  const [customEnd, setCustomEnd] = useState(customDefaultEnd.slice(0, 16));
  const [selectedPreview, setSelectedPreview] = useState<PayrollPreview>(currentPreview);
  const [excludedIds, setExcludedIds] = useState<string[]>(initialExcludedIds);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const periodKey = `${selectedPreview.weekStartIso}__${selectedPreview.weekEndIso}`;

  function computeWithConfig(preview: PayrollPreview, excluded: string[], cfg: PayrollPreview['config'], adjustments: Record<string, number>) {
    const maxMoney = Math.max(1, ...preview.members.map((row) => Number(row.moneyContribution ?? 0)));
    const maxActivity = Math.max(1, ...preview.members.map((row) => Number(row.activityCount ?? 0)));
    const maxParticipation = Math.max(1, ...preview.members.map((row) => Number(row.participationCount ?? 0)));
    const excludedSet = new Set(excluded);

    const rows = preview.members.map((row) => {
      const active = Boolean(row.isActive);
      const excludedMember = excludedSet.has(row.memberId);
      const hasEligibilitySignal = Number(row.activityCount ?? 0) >= cfg.minActions || Number(row.moneyContribution ?? 0) >= cfg.minMoney;
      const eligible = active && hasEligibilitySignal && !excludedMember;
      const moneyScore = Number(row.moneyContribution ?? 0) / maxMoney;
      const activityScore = Number(row.activityCount ?? 0) / maxActivity;
      const participationScore = Number(row.participationCount ?? 0) / maxParticipation;
      return {
        ...row,
        eligible,
        reason: excludedMember ? 'Exclu manuellement' : row.reason,
        moneyScore,
        activityScore,
        participationScore,
        totalScore: eligible
          ? (moneyScore * cfg.weights.money) + (activityScore * cfg.weights.activity) + (participationScore * cfg.weights.participation)
          : 0,
        proposedPay: 0
      };
    });

    const pool = Math.max(0, Math.round(preview.envelope));
    const eligibleRows = rows.filter((row) => row.eligible);
    const totalScore = eligibleRows.reduce((sum, row) => sum + row.totalScore, 0);
    if (pool > 0 && totalScore > 0) {
      for (const row of eligibleRows) {
        const proportional = pool * (row.totalScore / totalScore);
        row.proposedPay = Math.min(cfg.memberCap, Math.max(cfg.memberMinimum, Math.round(proportional)));
      }
      const currentTotal = eligibleRows.reduce((sum, row) => sum + row.proposedPay, 0);
      if (currentTotal > pool && currentTotal > 0) {
        const scale = pool / currentTotal;
        for (const row of eligibleRows) row.proposedPay = Math.max(0, Math.round(row.proposedPay * scale));
      }
    }

    for (const row of rows) {
      if (!row.eligible) continue;
      const adjusted = Number(adjustments[row.memberId]);
      if (Number.isFinite(adjusted) && adjusted >= 0) row.proposedPay = Math.max(0, Math.min(cfg.memberCap, Math.round(adjusted)));
    }
    const total = rows.reduce((sum, row) => sum + (row.eligible ? Math.max(0, Number(row.proposedPay || 0)) : 0), 0);
    return {
      ...preview,
      config: cfg,
      members: rows,
      totalProposed: Math.round(total),
      balanceAfter: preview.balance - Math.round(total),
      eligibleCount: rows.filter((row) => row.eligible).length,
      ineligibleCount: rows.filter((row) => !row.eligible).length
    };
  }

  async function loadCustomPreview(startIso: string, endIso: string) {
    const response = await fetch(`/api/money/payroll?period=custom&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json() as { selected?: PayrollPreview };
    if (payload.selected) setSelectedPreview(payload.selected);
  }

  const effectivePreview = useMemo(() => {
    return computeWithConfig(selectedPreview, excludedIds, config, manualAdjustments);
  }, [config, excludedIds, manualAdjustments, selectedPreview]);

  async function toggleExclusion(memberId: string) {
    const willExclude = !excludedIds.includes(memberId);
    setExcludedIds((cur) => willExclude ? [...cur, memberId] : cur.filter((id) => id !== memberId));
    await fetch('/api/money/payroll/exclusions', {
      method: willExclude ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start_iso: selectedPreview.weekStartIso, week_end_iso: selectedPreview.weekEndIso, member_user_id: memberId })
    }).catch(() => {});
  }

  const historyByRun = useMemo(() => {
    const map = new Map<number, HistoryRunMember[]>();
    for (const row of historyMembers) {
      const list = map.get(row.payroll_run_id) ?? [];
      list.push(row);
      map.set(row.payroll_run_id, list);
    }
    return map;
  }, [historyMembers]);

  async function validatePayroll() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const response = await fetch('/api/money/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start_iso: selectedPreview.weekStartIso,
        week_end_iso: selectedPreview.weekEndIso,
        period_mode: selectedPreview.periodMode ?? (periodMode === 'custom' ? 'custom' : 'weekly'),
        config,
        excluded_member_ids: excludedIds,
        manual_adjustments: manualAdjustments
      })
    });
    setSubmitting(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Validation paye impossible.' }));
      setError(payload.message ?? 'Validation paye impossible.');
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 lg:grid-cols-5">
        <Card label="💳 Argent groupe" value={formatUsd(effectivePreview.balance)} />
        <Card label="🛡️ Réserve conservée" value={formatUsd(effectivePreview.reserveKept)} />
        <Card label="📦 Enveloppe paye" value={formatUsd(effectivePreview.envelope)} />
        <Card label="✅ Total payes calculées" value={formatUsd(effectivePreview.totalProposed)} />
        <Card label="🏦 Solde après paye" value={formatUsd(effectivePreview.balanceAfter)} />
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">Période de calcul</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={`filter-pill ${periodMode === 'current' ? 'filter-pill-active' : ''}`} onClick={() => { setPeriodMode('current'); setSelectedPreview(currentPreview); setManualAdjustments({}); }}>Semaine actuelle</button>
          <button className={`filter-pill ${periodMode === 'previous' ? 'filter-pill-active' : ''}`} onClick={() => { setPeriodMode('previous'); setSelectedPreview(previousPreview); setManualAdjustments({}); }}>Semaine passée</button>
          <button className={`filter-pill ${periodMode === 'custom' ? 'filter-pill-active' : ''}`} onClick={() => { setPeriodMode('custom'); setSelectedPreview(customPreview); setManualAdjustments({}); }}>Période personnalisée</button>
        </div>
        {periodMode === 'custom' ? (
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input className="saas-input" type="datetime-local" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            <input className="saas-input" type="datetime-local" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            <button className="saas-primary-btn" onClick={() => void loadCustomPreview(new Date(customStart).toISOString(), new Date(customEnd).toISOString())}>Appliquer</button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[#efcdab]">Période active: {effectivePreview.weekStartIso.slice(0, 16).replace('T', ' ')} → {effectivePreview.weekEndIso.slice(0, 16).replace('T', ' ')} · Exclusions: {excludedIds.length} ({periodKey})</p>
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">Comparaison semaines</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-[#3b2518]/60 p-3 text-xs text-[#efcdab]">
            <p className="font-semibold text-[#ffe8ca]">Semaine actuelle</p>
            <p>{effectivePreview.weekStartIso.slice(0, 10)} → {effectivePreview.weekEndIso.slice(0, 10)}</p>
            <p>Éligibles: {effectivePreview.eligibleCount} · Enveloppe: {formatUsd(effectivePreview.envelope)}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-[#3b2518]/60 p-3 text-xs text-[#efcdab]">
            <p className="font-semibold text-[#ffe8ca]">Semaine passée</p>
            <p>{previousPreview.weekStartIso.slice(0, 10)} → {previousPreview.weekEndIso.slice(0, 10)}</p>
            <p>Éligibles: {previousPreview.eligibleCount} · Enveloppe: {formatUsd(previousPreview.envelope)}</p>
          </article>
        </div>
      </section>

      <section className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#fff1dd]">Réglages paye</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <Field label="Réserve minimale" value={config.reserveMinimum} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, reserveMinimum: Math.max(0, v) }))} disabled={!canConfigure} />
          <Field label="% distribuable" value={Math.round(config.distributablePercent * 100)} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, distributablePercent: Math.max(0, Math.min(100, v)) / 100 }))} disabled={!canConfigure} />
          <Field label="Plafond membre" value={config.memberCap} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, memberCap: Math.max(0, v) }))} disabled={!canConfigure} />
          <Field label="Minimum membre" value={config.memberMinimum} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, memberMinimum: Math.max(0, v) }))} disabled={!canConfigure} />
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          <Field label="Poids argent (%)" value={Math.round(config.weights.money * 100)} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, weights: { ...cur.weights, money: Math.max(0, v) / 100 } }))} disabled={!canConfigure} />
          <Field label="Poids activité (%)" value={Math.round(config.weights.activity * 100)} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, weights: { ...cur.weights, activity: Math.max(0, v) / 100 } }))} disabled={!canConfigure} />
          <Field label="Poids participation (%)" value={Math.round(config.weights.participation * 100)} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, weights: { ...cur.weights, participation: Math.max(0, v) / 100 } }))} disabled={!canConfigure} />
          <Field label="Seuil actions" value={config.minActions} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, minActions: Math.max(0, v) }))} disabled={!canConfigure} />
          <Field label="Seuil argent" value={config.minMoney} onChange={(v) => canConfigure && setConfig((cur) => ({ ...cur, minMoney: Math.max(0, v) }))} disabled={!canConfigure} />
        </div>
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">Membres · contribution / éligibilité / paye</h3>
        <div className="mt-2 space-y-2 max-h-[520px] overflow-auto pr-1">
          {effectivePreview.members.map((member) => (
            <article key={member.memberId} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
              <div className="grid gap-2 md:grid-cols-[1.5fr_repeat(6,minmax(0,1fr))] md:items-center">
                <div>
                  <p className="font-semibold text-[#ffe8ca]">{member.memberLabel}</p>
                  <p>{member.reason}</p>
                </div>
                <p>💵 {formatUsd(member.moneyContribution)}</p>
                <p>🎯 {member.activityCount} actions</p>
                <p>🤝 {member.participationCount} participations</p>
                <p>📊 {member.totalScore.toFixed(2)}</p>
                <p className="font-semibold text-[#ffe8ca]">{formatUsd(member.proposedPay)}</p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className={`saas-ghost-btn !py-1 !px-2 ${excludedIds.includes(member.memberId) ? 'opacity-50' : ''}`}
                    onClick={() => void toggleExclusion(member.memberId)}
                  >
                    {excludedIds.includes(member.memberId) ? 'Réinclure' : 'Exclure'}
                  </button>
                  <input
                    className="saas-input !h-8 w-24"
                    value={manualAdjustments[member.memberId] ?? ''}
                    onChange={(event) => canAdjust && setManualAdjustments((cur) => ({ ...cur, [member.memberId]: Math.max(0, Number(event.target.value || 0)) }))}
                    placeholder="Ajuster"
                    disabled={!canAdjust}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[#fff1dd]">Validation</h3>
        <p className="mt-1 text-xs text-[#efcdab]">Le total distribué ne peut pas dépasser l’enveloppe. La semaine est figée après validation.</p>
        {error ? <p className="mt-2 rounded-lg border border-red-300/50 bg-red-500/10 px-2 py-1 text-xs text-red-100">{error}</p> : null}
        {canValidate ? <button className="saas-primary-btn mt-3" disabled={submitting} onClick={() => void validatePayroll()}>{submitting ? 'Validation…' : 'Valider les payes'}</button> : <p className="mt-2 text-xs text-[#efcdab]">Permission manquante pour valider.</p>}
      </section>

      {canHistory ? (
        <section className="glass-card p-4">
          <h3 className="text-sm font-semibold text-[#fff1dd]">Historique paye</h3>
          <div className="mt-2 space-y-2">
            {history.map((run) => (
              <article key={run.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
                <p className="font-semibold text-[#ffe8ca]">{run.period_mode === 'custom' ? 'Période personnalisée' : 'Semaine'} {run.week_start.slice(0, 10)} → {run.week_end.slice(0, 10)} · {formatUsd(Number(run.total_distributed ?? 0))}</p>
                <p>Validée par {run.validated_by_label || 'N/A'} · {new Date(run.validated_at).toLocaleString('fr-FR')}</p>
                <p>Avant: {formatUsd(Number(run.group_balance_before ?? 0))} · Après: {formatUsd(Number(run.group_balance_after ?? 0))} · Réserve: {formatUsd(Number(run.reserve_kept ?? 0))}</p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(historyByRun.get(run.id) ?? []).map((member) => (
                    <p key={member.id} className="rounded-lg border border-white/10 bg-[#2b1a12]/55 px-2 py-1">{member.member_label}: <span className="text-[#ffe8ca]">{formatUsd(Number(member.amount ?? 0))}</span></p>
                  ))}
                </div>
              </article>
            ))}
            {history.length === 0 ? <p className="text-xs text-[#efcdab]">Aucun historique de paye.</p> : null}
          </div>
        </section>
      ) : null}

      {canLogs ? (
        <section className="glass-card p-4">
          <h3 className="text-sm font-semibold text-[#fff1dd]">Logs paye</h3>
          <div className="mt-2 space-y-1">
            {logs.map((entry) => (
              <p key={entry.id} className="rounded-lg border border-white/10 bg-[#2b1a12]/55 px-2 py-1 text-xs text-[#efcdab]">[{new Date(entry.created_at).toLocaleString('fr-FR')}] <span className="text-[#ffe8ca]">{entry.action}</span> · {entry.summary}</p>
            ))}
            {logs.length === 0 ? <p className="text-xs text-[#efcdab]">Aucun log paye.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><p className="text-xs text-[#efcdab]">{label}</p><p className="text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function Field({ label, value, onChange, disabled }: { label: string; value: number; onChange: (next: number) => void; disabled?: boolean }) {
  return (
    <label className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-2 text-xs text-[#efcdab]">
      <span>{label}</span>
      <input className="saas-input mt-1" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} disabled={disabled} />
    </label>
  );
}
