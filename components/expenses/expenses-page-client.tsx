'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';

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

type LogRow = { id: number; action: string; summary: string; actor_name: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };
type Tab = 'new' | 'pending' | 'reimbursed' | 'stats' | 'logs';

const CATEGORIES = ['Achat stock', 'Matériel', 'Véhicule', 'Braquage', 'Drogue', 'Jobs', 'Autre'];

export function ExpensesPageClient({
  members,
  pending,
  reimbursed,
  statsRows,
  logs,
  groupCash,
  canCreate,
  canReimburse,
  canHistory,
  canStats,
  canLogs,
  canDelete
}: {
  members: Array<{ id: string; name: string }>;
  pending: Expense[];
  reimbursed: Expense[];
  statsRows: Expense[];
  logs: LogRow[];
  groupCash: number;
  canCreate: boolean;
  canReimburse: boolean;
  canHistory: boolean;
  canStats: boolean;
  canLogs: boolean;
  canDelete: boolean;
}) {
  const [tab, setTab] = useState<Tab>(canCreate ? 'new' : 'pending');
  const [pendingRows, setPendingRows] = useState(pending);
  const [reimbursedRows, setReimbursedRows] = useState(reimbursed);
  const [statsState, setStatsState] = useState(statsRows);
  const [cashState, setCashState] = useState(groupCash);
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Achat stock');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const allStatsRows = useMemo(() => {
    const source = statsState.length > 0 ? statsState : [...pendingRows, ...reimbursedRows];
    return source.filter((row) => row.status === 'pending' || row.status === 'reimbursed');
  }, [pendingRows, reimbursedRows, statsState]);
  const totals = useMemo(() => {
    const source = allStatsRows;
    const pendingTotal = source.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const reimbursedTotal = source.filter((row) => row.status === 'reimbursed').reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const reimbursedWithDates = source.filter((row) => row.status === 'reimbursed' && row.reimbursed_at);
    const avgDays = reimbursedWithDates.length
      ? reimbursedWithDates.reduce((sum, row) => sum + Math.max(0, new Date(String(row.reimbursed_at)).getTime() - new Date(row.created_at).getTime()) / 86400000, 0) / reimbursedWithDates.length
      : 0;
    return { pendingTotal, reimbursedTotal, count: source.length, avgDays };
  }, [allStatsRows]);

  const byCategory = useMemo(() => groupRows(allStatsRows, (row) => row.category), [allStatsRows]);
  const byMember = useMemo(() => groupRows(allStatsRows, (row) => row.member_name), [allStatsRows]);
  const latest = useMemo(() => [...allStatsRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6), [allStatsRows]);

  async function createExpense() {
    setError('');
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, label, amount: Number(amount), category, note, proof_url: proofUrl })
    });
    const payload = await response.json().catch(() => ({} as { message?: string; expense?: Expense }));
    if (!response.ok || !payload.expense) return setError(payload.message ?? 'Création dépense impossible.');
    setPendingRows((rows) => [payload.expense as Expense, ...rows]);
    setStatsState((rows) => [payload.expense as Expense, ...rows]);
    setLabel('');
    setAmount('');
    setNote('');
    setProofUrl('');
    setStatus('Dépense ajoutée en attente.');
  }

  async function reimburse(row: Expense) {
    setError('');
    if (Number(row.amount) >= 5000 && !window.confirm(`Rembourser ${formatUsd(row.amount)} à ${row.member_name} ?`)) return;
    const response = await fetch(`/api/expenses/${row.id}/reimburse`, { method: 'POST' });
    const payload = await response.json().catch(() => ({} as { message?: string; expense?: Expense; cashAfter?: number }));
    if (!response.ok || !payload.expense) return setError(payload.message ?? 'Remboursement impossible.');
    setPendingRows((rows) => rows.filter((entry) => entry.id !== row.id));
    setReimbursedRows((rows) => [payload.expense as Expense, ...rows]);
    setStatsState((rows) => rows.map((entry) => entry.id === row.id ? payload.expense as Expense : entry));
    if (typeof payload.cashAfter === 'number') setCashState(payload.cashAfter);
    setStatus('Dépense remboursée.');
  }

  async function cancel(row: Expense) {
    setError('');
    const response = await fetch(`/api/expenses/${row.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({} as { message?: string; expense?: Expense }));
    if (!response.ok || !payload.expense) return setError(payload.message ?? 'Annulation impossible.');
    setPendingRows((rows) => rows.filter((entry) => entry.id !== row.id));
    setStatsState((rows) => rows.map((entry) => entry.id === row.id ? payload.expense as Expense : entry));
    setStatus('Dépense annulée.');
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Stat icon="🧾" label="En attente" value={formatUsd(totals.pendingTotal)} />
        <Stat icon="✅" label="Remboursé" value={formatUsd(totals.reimbursedTotal)} />
        <Stat icon="📌" label="Dépenses" value={String(totals.count)} />
        <Stat icon="💰" label="Argent groupe" value={formatUsd(cashState)} />
      </section>

      <section className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          {canCreate ? <TabButton active={tab === 'new'} onClick={() => setTab('new')}>➕ Nouvelle dépense</TabButton> : null}
          <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>🕒 Dépenses en attente</TabButton>
          {canHistory ? <TabButton active={tab === 'reimbursed'} onClick={() => setTab('reimbursed')}>✅ Remboursées</TabButton> : null}
          {canStats ? <TabButton active={tab === 'stats'} onClick={() => setTab('stats')}>📊 Stats</TabButton> : null}
          {canLogs ? <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>🧾 Logs</TabButton> : null}
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {status ? <p className="rounded-xl border border-white/10 bg-[#4a2f20]/45 px-3 py-2 text-sm text-[#efcdab]">{status}</p> : null}

      {tab === 'new' && canCreate ? (
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#fff1dd]">Nouvelle dépense</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Membre"><select className="saas-input" value={memberId} onChange={(event) => setMemberId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
            <Field label="Catégorie"><select className="saas-input" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></Field>
            <Field label="Libellé"><input className="saas-input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex: Forets pour Fleeca" /></Field>
            <Field label="Montant"><input className="saas-input" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" /></Field>
            <Field label="Preuve image (URL optionnelle)"><input className="saas-input" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https://..." /></Field>
            <Field label="Note optionnelle"><input className="saas-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Détail utile" /></Field>
          </div>
          <button className="saas-primary-btn mt-4" disabled={!memberId || !label.trim() || Number(amount) <= 0} onClick={() => void createExpense()}>Ajouter dépense</button>
        </section>
      ) : null}

      {tab === 'pending' ? (
        <ExpenseList rows={pendingRows} empty="Aucune dépense en attente." actions={(row) => (
          <>
            {canReimburse ? <button className="saas-primary-btn !px-3 !py-1.5 text-xs" onClick={() => void reimburse(row)}>💸 Rembourser</button> : null}
            {canDelete ? <button className="saas-ghost-btn !px-2 !py-1.5 text-xs" onClick={() => void cancel(row)}>Annuler</button> : null}
          </>
        )} />
      ) : null}

      {tab === 'reimbursed' && canHistory ? <ExpenseList rows={reimbursedRows} empty="Aucune dépense remboursée." /> : null}

      {tab === 'stats' && canStats ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <StatsBlock title="Dépenses par catégorie" rows={byCategory} />
          <StatsBlock title="Dépenses par membre" rows={byMember} />
          <article className="glass-card p-4">
            <h3 className="text-sm font-semibold text-[#fff1dd]">Moyenne remboursement</h3>
            <p className="mt-2 text-2xl font-semibold text-[#ffe8ca]">{totals.avgDays.toFixed(1)} jours</p>
          </article>
          <article className="glass-card p-4">
            <h3 className="text-sm font-semibold text-[#fff1dd]">Dernières dépenses</h3>
            <div className="mt-2 space-y-2">{latest.map((row) => <CompactExpense key={row.id} row={row} />)}</div>
          </article>
        </section>
      ) : null}

      {tab === 'logs' && canLogs ? (
        <section className="glass-card p-4">
          <h3 className="text-sm font-semibold text-[#fff1dd]">Logs Dépenses</h3>
          <div className="mt-2 space-y-2">
            {logs.map((log) => (
              <article key={log.id} className="rounded-lg border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]">
                <div className="flex flex-wrap justify-between gap-2"><b className="text-[#ffe8ca]">{log.action}</b><span>{new Date(log.created_at).toLocaleString('fr-FR')}</span></div>
                <p className="mt-1">{log.summary}</p>
                <p className="mt-1 text-[#d9b48f]">Utilisateur: {log.actor_name || 'Système'}</p>
              </article>
            ))}
            {logs.length === 0 ? <p className="text-sm text-[#efcdab]">Aucun log dépense.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function groupRows(rows: Expense[], key: (row: Expense) => string) {
  const map = new Map<string, { label: string; count: number; pending: number; reimbursed: number; total: number }>();
  for (const row of rows) {
    if (row.status !== 'pending' && row.status !== 'reimbursed') continue;
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={`filter-pill ${active ? 'filter-pill-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs text-[#efcdab]"><span className="mb-1 block">{label}</span>{children}</label>;
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function ExpenseList({ rows, empty, actions }: { rows: Expense[]; empty: string; actions?: (row: Expense) => ReactNode }) {
  return (
    <section className="space-y-2">
      {rows.map((row) => <article key={row.id} className="glass-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><CompactExpense row={row} />{actions ? <div className="flex gap-2">{actions(row)}</div> : null}</div></article>)}
      {rows.length === 0 ? <article className="glass-card p-4 text-sm text-[#efcdab]">{empty}</article> : null}
    </section>
  );
}

function CompactExpense({ row }: { row: Expense }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1 text-xs text-[#efcdab]">{row.category}</span>
        <span className="rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1 text-xs text-[#efcdab]">{row.status === 'pending' ? 'En attente' : row.status === 'reimbursed' ? 'Remboursée' : 'Annulée'}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-[#fff1dd]">{row.member_name} — {row.label}</h3>
      <p className="text-lg font-semibold text-[#ffe8ca]">{formatUsd(row.amount)}</p>
      <p className="text-xs text-[#efcdab]">Créée le {new Date(row.created_at).toLocaleString('fr-FR')}{row.reimbursed_at ? ` · Remboursée le ${new Date(row.reimbursed_at).toLocaleString('fr-FR')}` : ''}</p>
      {row.reimbursed_by_name ? <p className="text-xs text-[#d9b48f]">Remboursé par {row.reimbursed_by_name}</p> : null}
      {row.note ? <p className="mt-1 text-sm text-[#efcdab]">{row.note}</p> : null}
      {row.proof_url ? <a className="mt-1 inline-block text-xs text-[#ffe8ca] underline" href={row.proof_url} target="_blank" rel="noreferrer">Voir preuve</a> : null}
      {row.money_before != null && row.money_after != null ? <p className="mt-1 text-xs text-[#d9b48f]">Groupe {formatUsd(row.money_before)} → {formatUsd(row.money_after)}</p> : null}
    </div>
  );
}

function StatsBlock({ title, rows }: { title: string; rows: Array<{ label: string; count: number; pending: number; reimbursed: number; total: number }> }) {
  return (
    <article className="glass-card p-4">
      <h3 className="text-sm font-semibold text-[#fff1dd]">{title}</h3>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-xs text-[#efcdab]">
            <div className="flex justify-between gap-2"><b className="text-[#ffe8ca]">{row.label}</b><span>{row.count}</span></div>
            <p>En attente {formatUsd(row.pending)} · Remboursé {formatUsd(row.reimbursed)}</p>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune donnée.</p> : null}
      </div>
    </article>
  );
}
