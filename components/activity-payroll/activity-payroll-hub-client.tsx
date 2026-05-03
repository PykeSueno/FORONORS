'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatUsd } from '@/lib/currency';
import type { PayrollMemberRow } from '@/lib/payroll';
import type { MemberActivityRow } from '@/lib/payroll-service';

type Tab = 'global' | 'activities' | 'payroll' | 'history' | 'logs';
type MemberSummary = { id: string; name: string; username: string; isActive: boolean; moneyGenerated: number; activityCount: number; proposedPay: number; lastActivity: string | null };
type HistoryRow = { id: number; action: string; summary: string; actor_name: string | null; entity_id: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };

type Props = {
  members: MemberSummary[];
  payrollRows: PayrollMemberRow[];
  activities: MemberActivityRow[];
  history: HistoryRow[];
  logs: HistoryRow[];
  period: { startIso: string; endIso: string; previousStartIso: string; previousEndIso: string };
  paidMembers: Record<string, number>;
  canActivities: boolean;
  canPayroll: boolean;
  canPay: boolean;
  canHistory: boolean;
  canLogs: boolean;
};

export function ActivityPayrollHubClient(props: Props) {
  const [tab, setTab] = useState<Tab>('global');
  const [memberFilter, setMemberFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'current' | 'previous'>('current');
  const [dateFilter, setDateFilter] = useState('');
  const [paidMembers, setPaidMembers] = useState(props.paidMembers);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const modules = useMemo(() => Array.from(new Set(props.activities.map((row) => row.module))).sort((a, b) => a.localeCompare(b, 'fr')), [props.activities]);
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

  async function pay(row: PayrollMemberRow) {
    setError('');
    setMessage('');
    const response = await fetch('/api/activity-payroll/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start_iso: props.period.startIso,
        week_end_iso: props.period.endIso,
        member_id: row.memberId,
        member_label: row.memberLabel,
        amount: row.proposedPay
      })
    });
    const payload = await response.json().catch(() => ({} as { message?: string; paid?: Record<string, number> }));
    if (!response.ok) {
      setError(payload.message ?? 'Paiement impossible.');
      return;
    }
    if (payload.paid) setPaidMembers(payload.paid);
    setMessage('Paye versée.');
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Metric label="Argent généré" value={formatUsd(totals.money)} />
        <Metric label="Activités" value={String(totals.activities)} />
        <Metric label="Paye estimée" value={formatUsd(totals.payroll)} />
        <Metric label="Déjà payé" value={formatUsd(totals.paid)} />
      </section>

      <section className="glass-card p-3"><div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'global'} onClick={() => setTab('global')}>Vue globale</TabButton>
        {props.canActivities ? <TabButton active={tab === 'activities'} onClick={() => setTab('activities')}>Activités</TabButton> : null}
        {props.canPayroll ? <TabButton active={tab === 'payroll'} onClick={() => setTab('payroll')}>Payes</TabButton> : null}
        {props.canHistory ? <TabButton active={tab === 'history'} onClick={() => setTab('history')}>Historique</TabButton> : null}
        {props.canLogs ? <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</TabButton> : null}
      </div></section>

      {message ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {tab === 'global' ? <section className="glass-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-semibold text-[#fff1dd]">Par membre</h2><span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{props.members.length} membres</span></div>
        <div className="grid gap-2 xl:grid-cols-2">{props.members.map((member) => <article key={member.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><div className="grid gap-3 sm:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_auto] sm:items-center"><div><p className="font-semibold text-[#ffe8ca]">{member.name || member.username}</p><p className="text-xs text-[#efcdab]">{member.isActive ? 'Actif' : 'Inactif'}</p></div><Mini label="Argent" value={formatUsd(member.moneyGenerated)} /><Mini label="Activités" value={String(member.activityCount)} /><Mini label="Paye" value={formatUsd(member.proposedPay)} /><Mini label="Dernière" value={member.lastActivity ? new Date(member.lastActivity).toLocaleDateString('fr-FR') : '-'} /><button className="saas-primary-btn !h-9 whitespace-nowrap px-3" onClick={() => switchToMember(member.id)}>Voir détail</button></div></article>)}</div>
      </section> : null}

      {tab === 'activities' && props.canActivities ? <section className="glass-card p-4">
        <div className="mb-3 grid gap-2 lg:grid-cols-4"><select className="saas-input !h-10" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="all">Tous les membres</option>{props.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}</select><select className="saas-input !h-10" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="all">Tous les modules</option>{modules.map((module) => <option key={module} value={module}>{module}</option>)}</select><select className="saas-input !h-10" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as 'all' | 'current' | 'previous')}><option value="current">Semaine actuelle</option><option value="previous">Semaine passée</option><option value="all">Tout</option></select><input className="saas-input !h-10" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>
        <div className="max-h-[620px] overflow-auto pr-1"><table className="min-w-full text-left text-xs text-[#efcdab]"><thead className="sticky top-0 bg-[#2b1a12] text-[#ffe8ca]"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Membre</th><th className="px-2 py-2">Module</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Argent</th><th className="px-2 py-2">Participation</th><th className="px-2 py-2">Détails</th></tr></thead><tbody>{filteredActivities.map((row) => <tr key={row.id} className="border-t border-white/10"><td className="whitespace-nowrap px-2 py-2">{new Date(row.date).toLocaleString('fr-FR')}</td><td className="px-2 py-2 text-[#ffe8ca]">{row.memberLabels.join(', ') || '-'}</td><td className="px-2 py-2">{row.module}</td><td className="px-2 py-2">{row.action}</td><td className="px-2 py-2 font-semibold text-[#ffe8ca]">{formatUsd(row.moneyGenerated)}</td><td className="px-2 py-2">{row.participation}</td><td className="px-2 py-2">{row.details || '-'}</td></tr>)}</tbody></table>{filteredActivities.length === 0 ? <p className="p-3 text-xs text-[#efcdab]">Aucune activité.</p> : null}</div>
      </section> : null}

      {tab === 'payroll' && props.canPayroll ? <section className="glass-card p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-semibold text-[#fff1dd]">Payes</h2><span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">Paiement membre par membre</span></div><div className="space-y-2">{props.payrollRows.map((row) => { const isPaid = Boolean(paidMembers[row.memberId]); return <article key={row.memberId} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="grid gap-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_auto] xl:items-center"><div><p className="font-semibold text-[#ffe8ca]">{row.memberLabel}</p><p>{isPaid ? 'Payé' : row.eligible ? 'À payer' : 'Non éligible'}</p></div><Mini label="Rapporté" value={formatUsd(row.moneyContribution)} /><Mini label="Actions" value={String(row.activityCount)} /><Mini label="Implication" value={String(row.participationCount)} /><Mini label="Score" value={row.totalScore.toFixed(2)} /><Mini label="Paye" value={formatUsd(row.proposedPay)} />{props.canPay ? <button className="saas-primary-btn !h-9 px-3" disabled={isPaid || !row.eligible || row.proposedPay <= 0} onClick={() => void pay(row)}>{isPaid ? 'Payé' : 'Payer'}</button> : null}</div></article>; })}</div></section> : null}

      {tab === 'history' && props.canHistory ? <List title="Historique" rows={props.history} /> : null}
      {tab === 'logs' && props.canLogs ? <List title="Logs" rows={props.logs} verbose /> : null}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`filter-pill ${active ? 'filter-pill-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><p className="text-xs text-[#efcdab]">{label}</p><p className="text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-[#efcdab]">{label}</p><p className="font-semibold text-[#ffe8ca]">{value}</p></div>;
}

function List({ title, rows, verbose }: { title: string; rows: HistoryRow[]; verbose?: boolean }) {
  return <section className="glass-card p-4"><h2 className="mb-3 text-base font-semibold text-[#fff1dd]">{title}</h2><div className="max-h-[620px] space-y-2 overflow-auto pr-1">{rows.map((row) => { const amount = Number((row.new_values?.amount ?? row.new_values?.totalDistributed ?? row.new_values?.moneyAmount ?? 0) as number); return <article key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">{row.action}</p><p>{new Date(row.created_at).toLocaleString('fr-FR')}</p></div><p className="mt-1">{row.summary}</p><p className="mt-1">Membre: {String(row.new_values?.memberLabel ?? row.entity_id ?? '-')} · Montant: {amount ? formatUsd(amount) : '-'}</p>{verbose ? <p className="mt-1">Utilisateur: {row.actor_name || '-'} · Avant/Après: {JSON.stringify(row.old_values ?? {})} → {JSON.stringify(row.new_values ?? {})}</p> : <p className="mt-1">Validé par: {row.actor_name || '-'}</p>}</article>; })}{rows.length === 0 ? <p className="text-xs text-[#efcdab]">Aucune entrée.</p> : null}</div></section>;
}
