'use client';

import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import type { PayrollMemberRow } from '@/lib/payroll';
import type { MemberActivityRow } from '@/lib/payroll-service';

type Tab = 'global' | 'activities' | 'payroll' | 'history' | 'logs';
type MemberSummary = {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
  moneyGenerated: number;
  activityCount: number;
  proposedPay: number;
  lastActivity: string | null;
};
type HistoryRow = { id: number; action: string; summary: string; actor_name: string | null; entity_id: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };

type Props = {
  members: MemberSummary[];
  payrollRows: PayrollMemberRow[];
  activities: MemberActivityRow[];
  history: HistoryRow[];
  logs: HistoryRow[];
  period: { startIso: string; endIso: string; previousStartIso: string; previousEndIso: string };
  paidMembers: Record<string, number>;
  adjustments: Record<string, number>;
  excludedMemberIds: string[];
  reportedMembers: Record<string, string>;
  canActivities: boolean;
  canPayroll: boolean;
  canPay: boolean;
  canAdjust: boolean;
  canExclude: boolean;
  canHistory: boolean;
  canLogs: boolean;
};

export function MembersHubClient(props: Props) {
  const [tab, setTab] = useState<Tab>('global');
  const [memberFilter, setMemberFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'current' | 'previous'>('current');
  const [dateFilter, setDateFilter] = useState('');
  const [paidMembers, setPaidMembers] = useState(props.paidMembers);
  const [adjustments, setAdjustments] = useState(props.adjustments);
  const [excluded, setExcluded] = useState<string[]>(props.excludedMemberIds);
  const [reported, setReported] = useState(props.reportedMembers);
  const [draftAdjustments, setDraftAdjustments] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(props.adjustments).map(([id, value]) => [id, String(value)])));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const modules = useMemo(() => Array.from(new Set(props.activities.map((row) => row.module))).sort((a, b) => a.localeCompare(b, 'fr')), [props.activities]);
  const payrollByMember = useMemo(() => new Map(props.payrollRows.map((row) => [row.memberId, row])), [props.payrollRows]);

  const filteredActivities = useMemo(() => props.activities.filter((row) => {
    if (memberFilter !== 'all' && !row.memberIds.includes(memberFilter)) return false;
    if (moduleFilter !== 'all' && row.module !== moduleFilter) return false;
    if (dateFilter && row.date.slice(0, 10) !== dateFilter) return false;
    if (periodFilter === 'current' && !(row.date >= props.period.startIso && row.date < props.period.endIso)) return false;
    if (periodFilter === 'previous' && !(row.date >= props.period.previousStartIso && row.date < props.period.previousEndIso)) return false;
    return true;
  }), [dateFilter, memberFilter, moduleFilter, periodFilter, props.activities, props.period]);

  const totals = useMemo(() => ({
    money: props.members.reduce((sum, member) => sum + member.moneyGenerated, 0),
    activities: props.members.reduce((sum, member) => sum + member.activityCount, 0),
    payroll: props.payrollRows.reduce((sum, row) => sum + (row.eligible ? Number(row.proposedPay || 0) : 0), 0),
    paid: Object.values(paidMembers).reduce((sum, amount) => sum + Number(amount || 0), 0)
  }), [paidMembers, props.members, props.payrollRows]);

  function switchToMember(memberId: string) {
    setMemberFilter(memberId);
    setTab(props.canActivities ? 'activities' : 'global');
  }

  function payrollStatus(memberId: string, row?: PayrollMemberRow) {
    if (paidMembers[memberId]) return 'Payé';
    if (excluded.includes(memberId)) return 'Exclu';
    if (reported[memberId]) return 'Reporté';
    return row?.eligible ? 'À payer' : 'Reporté';
  }

  async function payrollAction(action: 'pay' | 'adjust' | 'exclude' | 'report', row: PayrollMemberRow, enabled = true) {
    setError('');
    setMessage('');
    const amount = action === 'adjust' ? Number(draftAdjustments[row.memberId] || 0) : Number(adjustments[row.memberId] ?? row.proposedPay ?? 0);
    const response = await fetch('/api/members/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        week_start_iso: props.period.startIso,
        week_end_iso: props.period.endIso,
        member_id: row.memberId,
        member_label: row.memberLabel,
        amount,
        enabled
      })
    });
    const payload = await response.json().catch(() => ({} as { message?: string; paid?: Record<string, number>; adjustments?: Record<string, number>; excluded?: string[]; reported?: Record<string, string> }));
    if (!response.ok) {
      setError(payload.message ?? 'Action impossible.');
      return;
    }
    if (payload.paid) setPaidMembers(payload.paid);
    if (payload.adjustments) setAdjustments(payload.adjustments);
    if (payload.excluded) setExcluded(payload.excluded);
    if (payload.reported) setReported(payload.reported);
    setMessage(action === 'pay' ? 'Membre payé.' : action === 'adjust' ? 'Ajustement enregistré.' : action === 'exclude' ? 'Statut exclusion mis à jour.' : 'Report enregistré.');
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Metric label="Argent généré" value={formatUsd(totals.money)} icon="💸" />
        <Metric label="Activités" value={String(totals.activities)} icon="🎯" />
        <Metric label="Paye estimée" value={formatUsd(totals.payroll)} icon="🏦" />
        <Metric label="Déjà payé" value={formatUsd(totals.paid)} icon="✅" />
      </section>

      <section className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'global'} onClick={() => setTab('global')}>Vue globale</TabButton>
          {props.canActivities ? <TabButton active={tab === 'activities'} onClick={() => setTab('activities')}>Activités</TabButton> : null}
          {props.canPayroll ? <TabButton active={tab === 'payroll'} onClick={() => setTab('payroll')}>Payes</TabButton> : null}
          {props.canHistory ? <TabButton active={tab === 'history'} onClick={() => setTab('history')}>Historique</TabButton> : null}
          {props.canLogs ? <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</TabButton> : null}
        </div>
      </section>

      {message ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {tab === 'global' ? (
        <section className="glass-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#fff1dd]">👥 Vue globale membres</h2>
            <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{props.members.length} membres</span>
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {props.members.map((member) => (
              <article key={member.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                <div className="grid gap-3 sm:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-[#ffe8ca]">{member.name || member.username}</p>
                    <p className="text-xs text-[#efcdab]">{member.isActive ? '🟢 Actif' : '⚪ Inactif'}</p>
                  </div>
                  <Mini label="Argent" value={formatUsd(member.moneyGenerated)} />
                  <Mini label="Activités" value={String(member.activityCount)} />
                  <Mini label="Paye" value={formatUsd(member.proposedPay)} />
                  <Mini label="Dernière" value={member.lastActivity ? new Date(member.lastActivity).toLocaleDateString('fr-FR') : '-'} />
                  <button className="saas-primary-btn !h-9 whitespace-nowrap px-3" onClick={() => switchToMember(member.id)}>Voir détail</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'activities' && props.canActivities ? (
        <section className="glass-card p-4">
          <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr]">
            <select className="saas-input !h-10" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
              <option value="all">Tous les membres</option>
              {props.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            <select className="saas-input !h-10" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
              <option value="all">Tous les modules</option>
              {modules.map((module) => <option key={module} value={module}>{module}</option>)}
            </select>
            <select className="saas-input !h-10" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as 'all' | 'current' | 'previous')}>
              <option value="current">Semaine actuelle</option>
              <option value="previous">Semaine passée</option>
              <option value="all">Tout</option>
            </select>
            <input className="saas-input !h-10" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </div>
          <div className="max-h-[620px] overflow-auto pr-1">
            <table className="min-w-full text-left text-xs text-[#efcdab]">
              <thead className="sticky top-0 bg-[#2b1a12] text-[#ffe8ca]"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Membre</th><th className="px-2 py-2">Module</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Argent</th><th className="px-2 py-2">Participation</th><th className="px-2 py-2">Détails</th></tr></thead>
              <tbody>
                {filteredActivities.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(row.date).toLocaleString('fr-FR')}</td>
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
            {filteredActivities.length === 0 ? <p className="p-3 text-xs text-[#efcdab]">Aucune activité sur ces filtres.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === 'payroll' && props.canPayroll ? (
        <section className="glass-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#fff1dd]">💸 Payes membres</h2>
            <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">Paiement membre par membre</span>
          </div>
          <div className="space-y-2">
            {props.payrollRows.map((row) => {
              const status = payrollStatus(row.memberId, row);
              const effectiveAmount = Number(adjustments[row.memberId] ?? row.proposedPay ?? 0);
              return (
                <article key={row.memberId} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
                  <div className="grid gap-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_360px] xl:items-center">
                    <div><p className="font-semibold text-[#ffe8ca]">{row.memberLabel}</p><p>{status}</p></div>
                    <Mini label="Rapporté" value={formatUsd(row.moneyContribution)} />
                    <Mini label="Actions" value={String(row.activityCount)} />
                    <Mini label="Participations" value={String(row.participationCount)} />
                    <Mini label="Score" value={row.totalScore.toFixed(2)} />
                    <Mini label="Paye" value={formatUsd(effectiveAmount)} />
                    <div className="flex flex-wrap justify-end gap-2">
                      {props.canPay ? <button className="saas-primary-btn !h-9 px-3" disabled={Boolean(paidMembers[row.memberId]) || excluded.includes(row.memberId) || effectiveAmount <= 0} onClick={() => void payrollAction('pay', { ...row, proposedPay: effectiveAmount })}>{paidMembers[row.memberId] ? 'Payé' : 'Payer'}</button> : null}
                      {props.canAdjust ? <input className="saas-input !h-9 w-24" placeholder="Montant" value={draftAdjustments[row.memberId] ?? ''} onChange={(event) => setDraftAdjustments((cur) => ({ ...cur, [row.memberId]: event.target.value }))} /> : null}
                      {props.canAdjust ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void payrollAction('adjust', row)}>Ajuster</button> : null}
                      {props.canExclude ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void payrollAction('exclude', row, !excluded.includes(row.memberId))}>{excluded.includes(row.memberId) ? 'Réinclure' : 'Exclure'}</button> : null}
                      {props.canAdjust ? <button className="saas-ghost-btn !h-9 px-3" onClick={() => void payrollAction('report', row, !reported[row.memberId])}>{reported[row.memberId] ? 'Annuler report' : 'Reporter'}</button> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === 'history' && props.canHistory ? <List title="Historique membres" rows={props.history} /> : null}
      {tab === 'logs' && props.canLogs ? <List title="Logs membres" rows={props.logs} verbose /> : null}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`filter-pill ${active ? 'filter-pill-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-[#efcdab]">{label}</p><p className="font-semibold text-[#ffe8ca]">{value}</p></div>;
}

function List({ title, rows, verbose }: { title: string; rows: HistoryRow[]; verbose?: boolean }) {
  return (
    <section className="glass-card p-4">
      <h2 className="mb-3 text-base font-semibold text-[#fff1dd]">{title}</h2>
      <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
        {rows.map((row) => {
          const amount = Number((row.new_values?.amount ?? row.new_values?.totalDistributed ?? 0) as number);
          return (
            <article key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#ffe8ca]">{row.action}</p>
                <p>{new Date(row.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <p className="mt-1">{row.summary}</p>
              <p className="mt-1">Membre: {String(row.new_values?.memberLabel ?? row.entity_id ?? '-')} · Montant: {amount ? formatUsd(amount) : '-'} · Statut: {row.action.includes('paid') ? 'Payé' : row.action.includes('excluded') ? 'Exclu' : row.action.includes('reported') ? 'Reporté' : '-'}</p>
              {verbose ? <p className="mt-1">Utilisateur: {row.actor_name || '-'} · Avant/Après: {JSON.stringify(row.old_values ?? {})} → {JSON.stringify(row.new_values ?? {})}</p> : <p className="mt-1">Validé par: {row.actor_name || '-'}</p>}
            </article>
          );
        })}
        {rows.length === 0 ? <p className="text-xs text-[#efcdab]">Aucune entrée.</p> : null}
      </div>
    </section>
  );
}
