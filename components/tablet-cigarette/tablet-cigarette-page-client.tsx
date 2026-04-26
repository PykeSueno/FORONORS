'use client';

import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { computeProcessorEstimates, PROCESSOR_BOAT_FROM_BOTTLES } from '@/lib/processor';

type TabletDay = { id: number; business_day: string; deposited_amount: number; chest_amount: number; passages_count: number; kits_added: number; cutters_added: number } | null;
type CigaretteDay = { id: number; business_day: string; chest_amount: number; passages_count: number; total_revenue: number; packs_sold: number; packs_deposit_remaining?: number } | null;

type TabletPassage = { id: number; member_label: string; before_cash: number; after_cash: number; before_kits: number; after_kits: number; before_cutters: number; after_cutters: number; created_at: string };
type CigarettePassage = { id: number; member_label: string; quantity_sold: number; revenue_amount: number; before_packs: number; after_packs: number; before_chest: number; after_chest: number; before_group_cash: number; after_group_cash: number; created_at: string };

type Tab = 'tablet' | 'cigarette' | 'processor' | 'history' | 'stats';

export function TabletCigarettePageClient(props: {
  members: Array<{ id: string; name: string; username: string }>;
  tabletBusinessDay: string;
  cigaretteBusinessDay: string;
  tabletDay: TabletDay;
  cigaretteDay: CigaretteDay;
  tabletPassages: TabletPassage[];
  cigarettePassages: CigarettePassage[];
  groupCash: number;
  kitsInStock: number;
  cuttersInStock: number;
  packsInStock: number;
  canTabletAccess: boolean;
  canCigaretteAccess: boolean;
  canTabletManageDaily: boolean;
  canTabletCreatePassage: boolean;
  canCigaretteCreatePassage: boolean;
  canCigaretteCreateForAny: boolean;
  canHistory: boolean;
  canStats: boolean;
  canProcessorView: boolean;
  canProcessorCreate: boolean;
  canProcessorStats: boolean;
  canProcessorLogs: boolean;
  processorSessions: Array<Record<string, unknown>>;
  defaultMemberId: string;
  defaultMemberLabel: string;
}) {
  const {
    members, tabletBusinessDay, cigaretteBusinessDay, tabletDay, cigaretteDay, tabletPassages, cigarettePassages, groupCash, kitsInStock, cuttersInStock, packsInStock,
    canTabletAccess, canCigaretteAccess, canTabletManageDaily, canTabletCreatePassage, canCigaretteCreatePassage, canCigaretteCreateForAny, canHistory, canStats,
    canProcessorView, canProcessorCreate, canProcessorStats, canProcessorLogs, processorSessions,
    defaultMemberId, defaultMemberLabel
  } = props;

  const [tab, setTab] = useState<Tab>(canTabletAccess ? 'tablet' : 'cigarette');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [deposit, setDeposit] = useState(String(tabletDay?.deposited_amount ?? 4000));
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);

  const [tabletDayState, setTabletDayState] = useState(tabletDay);
  const [cigaretteDayState, setCigaretteDayState] = useState(cigaretteDay);
  const [tabletPassagesState, setTabletPassagesState] = useState(tabletPassages);
  const [cigarettePassagesState, setCigarettePassagesState] = useState(cigarettePassages);
  const [groupCashState, setGroupCashState] = useState(groupCash);
  const [kitsState, setKitsState] = useState(kitsInStock);
  const [cuttersState, setCuttersState] = useState(cuttersInStock);
  const [packsState, setPacksState] = useState(packsInStock);
  const [processorSessionsState, setProcessorSessionsState] = useState(processorSessions);
  const [processorParticipants, setProcessorParticipants] = useState<string[]>([defaultMemberId]);
  const [processorBottles, setProcessorBottles] = useState(2);
  const [processorBoatFee, setProcessorBoatFee] = useState(false);
  const [processorRealReceived, setProcessorRealReceived] = useState('');
  const [processorRealFee, setProcessorRealFee] = useState('');
  const processorEstimate = useMemo(() => computeProcessorEstimates(processorBottles, processorBoatFee || processorBottles >= PROCESSOR_BOAT_FROM_BOTTLES), [processorBottles, processorBoatFee]);

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  async function saveTabletDeposit() {
    setError('');
    const response = await fetch('/api/tablet/day', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deposited_amount: Number(deposit) }) });
    if (!response.ok) return setError('Dépôt tablette impossible.');
    const payload = await response.json() as { day?: TabletDay };
    if (payload.day) setTabletDayState(payload.day);
    setStatus('Dépôt tablette mis à jour.');
  }

  async function createTabletPassage() {
    setError('');
    const response = await fetch('/api/tablet/passages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel }) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Passage tablette impossible.' }));
      return setError(data.message ?? 'Passage tablette impossible.');
    }
    const payload = await response.json() as { passage?: TabletPassage; day?: TabletDay; groupCash?: number; kitsInStock?: number; cuttersInStock?: number };
    if (payload.passage) setTabletPassagesState((cur) => [payload.passage as TabletPassage, ...cur]);
    if (payload.day) setTabletDayState(payload.day);
    if (typeof payload.groupCash === 'number') setGroupCashState(payload.groupCash);
    if (typeof payload.kitsInStock === 'number') setKitsState(payload.kitsInStock);
    if (typeof payload.cuttersInStock === 'number') setCuttersState(payload.cuttersInStock);
    setStatus('Passage tablette validé.');
  }

  async function createCigarettePassage() {
    setError('');
    const response = await fetch('/api/cigarette/passages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel }) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Passage cigarette impossible.' }));
      return setError(data.message ?? 'Passage cigarette impossible.');
    }
    const payload = await response.json() as { passage?: CigarettePassage; day?: CigaretteDay; packsInStock?: number; groupCash?: number };
    if (payload.passage) setCigarettePassagesState((cur) => [payload.passage as CigarettePassage, ...cur]);
    if (payload.day) setCigaretteDayState(payload.day);
    if (typeof payload.groupCash === 'number') setGroupCashState(payload.groupCash);
    if (typeof payload.packsInStock === 'number') setPacksState(payload.packsInStock);
    setStatus('Passage cigarette validé.');
  }

  const combinedHistory = useMemo(() => {
    const tabletRows = tabletPassagesState.map((entry) => ({ id: `t-${entry.id}`, type: 'tablet' as const, created_at: entry.created_at, member: entry.member_label, detail: `💰 ${entry.before_cash}$ → ${entry.after_cash}$ · 🧰 ${entry.before_kits}→${entry.after_kits} · 🪚 ${entry.before_cutters}→${entry.after_cutters}` }));
    const cigaretteRows = cigarettePassagesState.map((entry) => ({ id: `c-${entry.id}`, type: 'cigarette' as const, created_at: entry.created_at, member: entry.member_label, detail: `🚬 ${entry.before_packs}→${entry.after_packs} · 💵 ${formatUsd(entry.revenue_amount)} · Groupe ${formatUsd(entry.before_group_cash)}→${formatUsd(entry.after_group_cash)}` }));
    return [...tabletRows, ...cigaretteRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tabletPassagesState, cigarettePassagesState]);

  async function createProcessorSession(cancelled = false) {
    setError('');
    const response = await fetch('/api/tobacco/processor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_user_ids: processorParticipants,
        bottles: processorBottles,
        boat_fee_applied: processorBoatFee || processorBottles >= PROCESSOR_BOAT_FROM_BOTTLES,
        real_received: Number(processorRealReceived || processorEstimate.gainAverage),
        real_fee: Number(processorRealFee || processorEstimate.boatFee),
        vehicle_used: processorEstimate.vehicleSuggested,
        cancelled
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Session processeur impossible.' }));
      return setError(payload.message ?? 'Session processeur impossible.');
    }
    const payload = await response.json() as { session?: Record<string, unknown>; cashAfter?: number };
    if (payload.session) setProcessorSessionsState((cur) => [payload.session as Record<string, unknown>, ...cur]);
    if (typeof payload.cashAfter === 'number') setGroupCashState(payload.cashAfter);
    setStatus(cancelled ? 'Session processeur annulée.' : 'Session processeur validée.');
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-4">
        <div className="flex flex-wrap gap-2">
          {canTabletAccess ? <button type="button" className={`filter-pill ${tab === 'tablet' ? 'filter-pill-active' : ''}`} onClick={() => setTab('tablet')}>📱 Tablette</button> : null}
          {canCigaretteAccess ? <button type="button" className={`filter-pill ${tab === 'cigarette' ? 'filter-pill-active' : ''}`} onClick={() => setTab('cigarette')}>🚬 Cigarette / Tabac</button> : null}
          {canProcessorView ? <button type="button" className={`filter-pill ${tab === 'processor' ? 'filter-pill-active' : ''}`} onClick={() => setTab('processor')}>⚙️ Processeur</button> : null}
          {canHistory ? <button type="button" className={`filter-pill ${tab === 'history' ? 'filter-pill-active' : ''}`} onClick={() => setTab('history')}>📚 Historique</button> : null}
          {canStats ? <button type="button" className={`filter-pill ${tab === 'stats' ? 'filter-pill-active' : ''}`} onClick={() => setTab('stats')}>📊 Stats</button> : null}
        </div>
      </section>

      {(tab === 'tablet' && canTabletAccess) ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Tablette — {tabletBusinessDay}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label="Dépôt restant" value={`${tabletDayState?.chest_amount ?? 0}$`} icon="💰" />
              <Stat label="Argent groupe" value={formatUsd(groupCashState)} icon="🏦" />
              <Stat label="Kits" value={String(kitsState)} icon="🧰" />
              <Stat label="Disqueuses" value={String(cuttersState)} icon="🪚" />
              <Stat label="Passages" value={String(tabletDayState?.passages_count ?? 0)} icon="🧾" />
            </div>
          </article>
          <article className="glass-card p-5 space-y-2">
            <label className="text-xs text-[#efcdab]">Membre</label>
            <select className="saas-input" value={memberId} onChange={(e) => { setMemberId(e.target.value); const member = membersById.get(e.target.value); setMemberLabel(member ? (member.name || member.username) : defaultMemberLabel); }}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            <p className="text-[11px] text-[#efcdab]">Membre sélectionné: <span className="font-semibold text-[#ffe8ca]">{memberLabel}</span></p>
            {canTabletManageDaily ? (<><label className="text-xs text-[#efcdab]">Dépôt matin tablette</label><div className="flex gap-2"><input className="saas-input" value={deposit} onChange={(e) => setDeposit(e.target.value)} /><button className="saas-primary-btn" onClick={() => void saveTabletDeposit()}>Enregistrer</button></div></>) : null}
            {canTabletCreatePassage ? <button className="saas-primary-btn" onClick={() => void createTabletPassage()}>Valider passage tablette</button> : null}
          </article>
        </section>
      ) : null}

      {(tab === 'processor' && canProcessorView) ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <article className="glass-card p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#fff1dd]">Processeur — Nouvelle session</h3>
            <label className="text-xs text-[#efcdab]">Participants</label>
            <select className="saas-input" multiple value={processorParticipants} onChange={(event) => setProcessorParticipants(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            <label className="text-xs text-[#efcdab]">Bouteilles</label>
            <input className="saas-input" type="number" min={1} max={12} value={processorBottles} onChange={(event) => setProcessorBottles(Math.max(1, Math.min(12, Number(event.target.value || 0))))} />
            {processorBottles < 2 ? <p className="text-xs text-amber-200">⚠️ Minimum conseillé : 2 bouteilles.</p> : null}
            <label className="inline-flex items-center gap-2 text-xs text-[#efcdab]"><input type="checkbox" checked={processorBoatFee || processorBottles >= PROCESSOR_BOAT_FROM_BOTTLES} onChange={(e) => setProcessorBoatFee(e.target.checked)} /> Appliquer frais bateau (1500$)</label>
            <p className="text-xs text-[#efcdab]">Véhicule conseillé: <span className="text-[#ffe8ca] font-semibold">{processorEstimate.vehicleSuggested === 'boat' ? 'Bateau' : 'Voiture'}</span></p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Stat label="Coût matos" value={formatUsd(processorEstimate.materialCost)} icon="🧰" />
              <Stat label="Frais bateau" value={formatUsd(processorEstimate.boatFee)} icon="🛥️" />
              <Stat label="Processeurs" value={String(processorEstimate.processors)} icon="⚙️" />
              <Stat label="Gain moyen" value={formatUsd(processorEstimate.gainAverage)} icon="💵" />
              <Stat label="Gain max" value={formatUsd(processorEstimate.gainMax)} icon="📈" />
              <Stat label="Bénéfice moyen" value={formatUsd(processorEstimate.profitAverage)} icon="📊" />
            </div>
          </article>
          <article className="glass-card p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#fff1dd]">Résultat réel</h3>
            <input className="saas-input" placeholder="Argent reçu réel" value={processorRealReceived} onChange={(e) => setProcessorRealReceived(e.target.value)} />
            <input className="saas-input" placeholder="Frais réels" value={processorRealFee} onChange={(e) => setProcessorRealFee(e.target.value)} />
            {canProcessorCreate ? <div className="flex gap-2"><button className="saas-primary-btn" onClick={() => void createProcessorSession(false)}>Valider session</button><button className="saas-ghost-btn" onClick={() => void createProcessorSession(true)}>Annuler</button></div> : <p className="text-xs text-[#efcdab]">Permission create requise.</p>}
          </article>
        </section>
      ) : null}

      {(tab === 'cigarette' && canCigaretteAccess) ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Cigarette — {cigaretteBusinessDay}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label="Paquets vendus" value={String(cigaretteDayState?.packs_sold ?? 0)} icon="🚬" />
              <Stat label="Recette" value={formatUsd(Number(cigaretteDayState?.total_revenue ?? 0))} icon="💵" />
              <Stat label="Dépôt Cigarette" value={formatUsd(Number(cigaretteDayState?.chest_amount ?? 0))} icon="🏦" />
              <Stat label="Stock paquets" value={String(packsState)} icon="📦" />
              <Stat label="Argent groupe" value={formatUsd(groupCashState)} icon="💰" />
            </div>
          </article>
          <article className="glass-card p-5 space-y-2">
            <label className="text-xs text-[#efcdab]">Membre</label>
            <select className="saas-input" value={memberId} onChange={(e) => { setMemberId(e.target.value); const member = membersById.get(e.target.value); setMemberLabel(member ? (member.name || member.username) : defaultMemberLabel); }} disabled={!canCigaretteCreateForAny}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            {canCigaretteCreatePassage ? <button className="saas-primary-btn" onClick={() => void createCigarettePassage()}>Valider passage cigarette</button> : null}
          </article>
        </section>
      ) : null}

      {(tab === 'history' && canHistory) ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique unifié</h3>
          <div className="mt-3 space-y-2">
            {combinedHistory.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-sm text-[#f1d2ad]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#ffe8ca]">{entry.type === 'tablet' ? '📱 Tablette' : '🚬 Cigarette'} — {entry.member}</p>
                  <p className="text-xs">{new Date(entry.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <p className="mt-1 text-xs">{entry.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(tab === 'stats' && canStats) ? (
        <section className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <Stat label="Passages tablette" value={String(tabletPassagesState.length)} icon="📱" />
            <Stat label="Passages cigarette" value={String(cigarettePassagesState.length)} icon="🚬" />
            <Stat label="Recette cigarette" value={formatUsd(cigarettePassagesState.reduce((sum, row) => sum + Number(row.revenue_amount ?? 0), 0))} icon="💵" />
            <Stat label="Argent groupe" value={formatUsd(groupCashState)} icon="🏦" />
          </div>
          <article className="glass-card p-5">
            <h4 className="text-sm font-semibold text-[#fff1dd]">Stats Tablette</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-[#efcdab]">
                <thead className="text-[#ffe8ca]"><tr><th className="px-2 py-1">Membre</th><th className="px-2 py-1">Passages</th><th className="px-2 py-1">Argent rapporté</th><th className="px-2 py-1">Argent restant</th><th className="px-2 py-1">Dernière activité</th></tr></thead>
                <tbody>
                  {Array.from(tabletPassagesState.reduce((acc, row) => {
                    const prev = acc.get(row.member_label) ?? { count: 0, money: 0, last: row.created_at, remaining: row.after_cash };
                    prev.count += 1;
                    prev.money += Number(row.after_cash) - Number(row.before_cash);
                    prev.remaining = Number(row.after_cash);
                    if (new Date(row.created_at).getTime() > new Date(prev.last).getTime()) prev.last = row.created_at;
                    acc.set(row.member_label, prev);
                    return acc;
                  }, new Map<string, { count: number; money: number; remaining: number; last: string }>()).entries()).map(([name, row]) => (
                    <tr key={name} className="border-t border-white/10"><td className="px-2 py-1 text-[#ffe8ca]">{name}</td><td className="px-2 py-1">{row.count}</td><td className="px-2 py-1">{formatUsd(row.money)}</td><td className="px-2 py-1">{formatUsd(row.remaining)}</td><td className="px-2 py-1">{new Date(row.last).toLocaleString('fr-FR')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="glass-card p-5">
            <h4 className="text-sm font-semibold text-[#fff1dd]">Stats Cigarette</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-[#efcdab]">
                <thead className="text-[#ffe8ca]"><tr><th className="px-2 py-1">Membre</th><th className="px-2 py-1">Passages</th><th className="px-2 py-1">Argent rapporté</th><th className="px-2 py-1">Qté vendue</th><th className="px-2 py-1">Dernière activité</th></tr></thead>
                <tbody>
                  {Array.from(cigarettePassagesState.reduce((acc, row) => {
                    const prev = acc.get(row.member_label) ?? { count: 0, money: 0, qty: 0, last: row.created_at };
                    prev.count += 1;
                    prev.money += Number(row.revenue_amount ?? 0);
                    prev.qty += Number(row.quantity_sold ?? 0);
                    if (new Date(row.created_at).getTime() > new Date(prev.last).getTime()) prev.last = row.created_at;
                    acc.set(row.member_label, prev);
                    return acc;
                  }, new Map<string, { count: number; money: number; qty: number; last: string }>()).entries()).map(([name, row]) => (
                    <tr key={name} className="border-t border-white/10"><td className="px-2 py-1 text-[#ffe8ca]">{name}</td><td className="px-2 py-1">{row.count}</td><td className="px-2 py-1">{formatUsd(row.money)}</td><td className="px-2 py-1">{row.qty}</td><td className="px-2 py-1">{new Date(row.last).toLocaleString('fr-FR')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          {canProcessorStats ? (
            <article className="glass-card p-5">
              <h4 className="text-sm font-semibold text-[#fff1dd]">Stats Processeur</h4>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <Stat label="Sessions" value={String(processorSessionsState.filter((row) => row.status === 'validated').length)} icon="🧾" />
                <Stat label="Bouteilles" value={String(processorSessionsState.reduce((sum, row) => sum + Number(row.bottles ?? 0), 0))} icon="🍾" />
                <Stat label="Argent reçu" value={formatUsd(processorSessionsState.reduce((sum, row) => sum + Number(row.real_received ?? 0), 0))} icon="💵" />
                <Stat label="Bénéfice réel" value={formatUsd(processorSessionsState.reduce((sum, row) => sum + Number(row.real_profit ?? 0), 0))} icon="📈" />
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {(tab === 'history' && canProcessorLogs && processorSessionsState.length > 0) ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique Processeur</h3>
          <div className="mt-3 space-y-2">
            {processorSessionsState.slice(0, 50).map((entry) => (
              <article key={String(entry.id)} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#f1d2ad]">
                <p className="font-semibold text-[#ffe8ca]">{String(entry.status) === 'cancelled' ? '❌' : '✅'} {new Date(String(entry.created_at)).toLocaleString('fr-FR')} · {Number(entry.bottles ?? 0)} bouteilles · {String(entry.vehicle_used ?? entry.vehicle_suggested)}</p>
                <p>Participants: {Array.isArray(entry.participant_user_ids) ? (entry.participant_user_ids as string[]).join(', ') : '-'}</p>
                <p>Coût matos: {formatUsd(Number(entry.material_cost ?? 0))} · Frais bateau: {formatUsd(Number(entry.boat_fee ?? 0))} · Reçu: {formatUsd(Number(entry.real_received ?? 0))} · Bénéfice: {formatUsd(Number(entry.real_profit ?? 0))}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {status ? <p className="rounded-xl border border-white/10 bg-[#4a2f20]/45 px-3 py-2 text-sm text-[#efcdab]">{status}</p> : null}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}
