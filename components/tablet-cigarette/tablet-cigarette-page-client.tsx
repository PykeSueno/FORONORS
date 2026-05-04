'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { computeProcessorEstimates, PROCESSOR_BOAT_FROM_BOTTLES } from '@/lib/processor';

type TabletDay = { id: number; business_day: string; deposited_amount: number; chest_amount: number; passages_count: number; kits_added: number; cutters_added: number } | null;
type CigaretteDay = { id: number; business_day: string; chest_amount: number; passages_count: number; total_revenue: number; packs_sold: number; packs_deposit_remaining?: number } | null;

type TabletPassage = { id: number; member_label: string; before_cash: number; after_cash: number; before_kits: number; after_kits: number; before_cutters: number; after_cutters: number; created_at: string };
type CigarettePassage = { id: number; member_label: string; quantity_sold: number; revenue_amount: number; before_packs: number; after_packs: number; before_chest: number; after_chest: number; before_group_cash: number; after_group_cash: number; status?: string; created_at: string };

type Tab = 'home' | 'tablet' | 'cigarette' | 'processor' | 'history' | 'stats';
type HistoryCard = { id: string; title: string; meta: string; lines: string[] };

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
  processorInStock: number;
  processorImageUrl: string;
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
  canProcessorProduction: boolean;
  canProcessorSale: boolean;
  canProcessorStats: boolean;
  canProcessorLogs: boolean;
  processorSessions: Array<Record<string, unknown>>;
  defaultMemberId: string;
  defaultMemberLabel: string;
}) {
  const {
    members, tabletBusinessDay, cigaretteBusinessDay, tabletDay, cigaretteDay, tabletPassages, cigarettePassages, groupCash, kitsInStock, cuttersInStock, packsInStock, processorInStock, processorImageUrl,
    canTabletAccess, canCigaretteAccess, canTabletManageDaily, canTabletCreatePassage, canCigaretteCreatePassage, canCigaretteCreateForAny, canHistory, canStats,
    canProcessorView, canProcessorCreate, canProcessorProduction, canProcessorSale, canProcessorStats, canProcessorLogs, processorSessions,
    defaultMemberId, defaultMemberLabel
  } = props;

  const [tab, setTab] = useState<Tab>('home');
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
  const [processorRealFee, setProcessorRealFee] = useState('');
  const [processorSaleMemberId, setProcessorSaleMemberId] = useState(defaultMemberId);
  const [processorSaleQty, setProcessorSaleQty] = useState(10);
  const [processorRealReceived, setProcessorRealReceived] = useState('500');
  const [processorStockState, setProcessorStockState] = useState(processorInStock);
  const [cigarettePaymentMode, setCigarettePaymentMode] = useState<'cash' | 'bank'>('cash');

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const activeMemberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const activeProcessorSessions = useMemo(() => processorSessionsState.filter((row) => {
    const participantIds = Array.isArray(row.participant_user_ids) ? row.participant_user_ids as string[] : [];
    return participantIds.some((id) => activeMemberIds.has(id));
  }), [activeMemberIds, processorSessionsState]);
  const processorEstimate = useMemo(() => computeProcessorEstimates(processorBottles, processorBoatFee || processorBottles >= PROCESSOR_BOAT_FROM_BOTTLES), [processorBottles, processorBoatFee]);
  const processorSaleTotalEstimated = Math.max(0, Math.round(processorSaleQty * 0.5 * 100));
  const processorSaleTotalReal = Math.max(0, Number(processorRealReceived || 0));
  const tabletGenerated = Math.max(0, Number(tabletDayState?.deposited_amount ?? 0) - Number(tabletDayState?.chest_amount ?? 0));

  const processorSoldToday = useMemo(() => processorSessionsState
    .filter((row) => row.operation_type === 'sale' && row.status === 'validated' && Array.isArray(row.participant_user_ids) && row.participant_user_ids.includes(processorSaleMemberId))
    .filter((row) => String(row.created_at ?? '').slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, row) => sum + Number(row.processors_count ?? 0), 0), [processorSessionsState, processorSaleMemberId]);
  const processorRemainingToday = Math.max(0, 50 - processorSoldToday);

  const processorStatsQuick = useMemo(() => {
    const rows = activeProcessorSessions.filter((row) => row.status === 'validated');
    return {
      produced: rows.reduce((sum, row) => sum + Number(row.operation_type === 'production' ? row.processors_count : 0), 0),
      sold: rows.reduce((sum, row) => sum + Number(row.operation_type === 'sale' ? row.processors_count : 0), 0),
      revenue: rows.reduce((sum, row) => sum + Number(row.operation_type === 'sale' ? row.real_received : 0), 0),
      net: rows.reduce((sum, row) => sum + Number(row.real_profit ?? 0), 0)
    };
  }, [activeProcessorSessions]);

  const historyColumns = useMemo(() => {
    const tabletRows: HistoryCard[] = tabletPassagesState.map((entry) => ({
      id: `t-${entry.id}`,
      title: entry.member_label,
      meta: new Date(entry.created_at).toLocaleString('fr-FR'),
      lines: [
        `Cash ${formatUsd(entry.before_cash)} -> ${formatUsd(entry.after_cash)}`,
        `Kits ${entry.before_kits} -> ${entry.after_kits} · Disqueuses ${entry.before_cutters} -> ${entry.after_cutters}`
      ]
    }));

    const cigaretteRows: HistoryCard[] = cigarettePassagesState.map((entry) => ({
      id: `c-${entry.id}`,
      title: entry.member_label,
      meta: new Date(entry.created_at).toLocaleString('fr-FR'),
      lines: [
        `Paquets ${entry.before_packs} -> ${entry.after_packs} · ${formatUsd(entry.revenue_amount)}`,
        `${entry.status === 'pending_bank' ? 'Bank en attente' : entry.status === 'received_bank' ? 'Bank reçu' : 'Cash'} · Groupe ${formatUsd(entry.before_group_cash)} -> ${formatUsd(entry.after_group_cash)}`
      ]
    }));

    const processorRows: HistoryCard[] = processorSessionsState.slice(0, 100).map((entry) => {
      const isSale = String(entry.operation_type) === 'sale';
      const participantIds = Array.isArray(entry.participant_user_ids) ? entry.participant_user_ids as string[] : [];
      const participants = participantIds
        .map((id) => {
          const member = membersById.get(id);
          return member ? (member.name || member.username) : id;
        })
        .join(', ');
      return {
        id: `p-${String(entry.id)}`,
        title: isSale ? 'Vente' : 'Production',
        meta: new Date(String(entry.created_at)).toLocaleString('fr-FR'),
        lines: [
          `${participants || '-'} · Qté ${Number(entry.processors_count ?? 0)}`,
          `${isSale ? 'Reçu' : 'Coût'} ${formatUsd(isSale ? Number(entry.real_received ?? 0) : Number(entry.material_cost ?? 0) + Number(entry.boat_fee ?? 0))} · Stock ${Number(entry.stock_after ?? 0)}`
        ]
      };
    });

    return { tabletRows, cigaretteRows, processorRows };
  }, [tabletPassagesState, cigarettePassagesState, processorSessionsState, membersById]);

  function selectMember(id: string) {
    setMemberId(id);
    const member = membersById.get(id);
    setMemberLabel(member ? (member.name || member.username) : defaultMemberLabel);
  }

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
    const response = await fetch('/api/tablet/passages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel, payment_mode: cigarettePaymentMode }) });
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
    const response = await fetch('/api/cigarette/passages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel, payment_mode: cigarettePaymentMode }) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Passage cigarette impossible.' }));
      return setError(data.message ?? 'Passage cigarette impossible.');
    }
    const payload = await response.json() as { passage?: CigarettePassage; day?: CigaretteDay; packsInStock?: number; groupCash?: number };
    if (payload.passage) setCigarettePassagesState((cur) => [payload.passage as CigarettePassage, ...cur]);
    if (payload.day) setCigaretteDayState(payload.day);
    if (typeof payload.groupCash === 'number') setGroupCashState(payload.groupCash);
    if (typeof payload.packsInStock === 'number') setPacksState(payload.packsInStock);
    setStatus(cigarettePaymentMode === 'bank' ? 'Passage bank en attente de virement.' : 'Passage cash validé.');
  }

  async function createProcessorProduction() {
    setError('');
    const response = await fetch('/api/tobacco/processor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation_type: 'production',
        participant_user_ids: processorParticipants,
        bottles: processorBottles,
        boat_fee_applied: processorBoatFee || processorBottles >= PROCESSOR_BOAT_FROM_BOTTLES,
        real_fee: Number(processorRealFee || processorEstimate.boatFee),
        vehicle_used: processorEstimate.vehicleSuggested
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Session processeur impossible.' }));
      return setError(payload.message ?? 'Session processeur impossible.');
    }
    const payload = await response.json() as { session?: Record<string, unknown>; cashAfter?: number; processorStock?: number };
    if (payload.session) setProcessorSessionsState((cur) => [payload.session as Record<string, unknown>, ...cur]);
    if (typeof payload.cashAfter === 'number') setGroupCashState(payload.cashAfter);
    if (typeof payload.processorStock === 'number') setProcessorStockState(payload.processorStock);
    setStatus('Production processeur validée.');
  }

  async function createProcessorSale() {
    setError('');
    const response = await fetch('/api/tobacco/processor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation_type: 'sale',
        seller_user_id: processorSaleMemberId,
        quantity: processorSaleQty,
        real_received: processorSaleTotalReal
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Vente processeur impossible.' }));
      return setError(payload.message ?? 'Vente processeur impossible.');
    }
    const payload = await response.json() as { session?: Record<string, unknown>; cashAfter?: number; processorStock?: number };
    if (payload.session) setProcessorSessionsState((cur) => [payload.session as Record<string, unknown>, ...cur]);
    if (typeof payload.cashAfter === 'number') setGroupCashState(payload.cashAfter);
    if (typeof payload.processorStock === 'number') setProcessorStockState(payload.processorStock);
    setStatus('Vente processeur validée.');
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`filter-pill ${tab === 'home' ? 'filter-pill-active' : ''}`} onClick={() => setTab('home')}>🏠 Accueil</button>
          {canTabletAccess ? <button type="button" className={`filter-pill ${tab === 'tablet' ? 'filter-pill-active' : ''}`} onClick={() => setTab('tablet')}>📱 Tablette</button> : null}
          {canCigaretteAccess ? <button type="button" className={`filter-pill ${tab === 'cigarette' ? 'filter-pill-active' : ''}`} onClick={() => setTab('cigarette')}>🚬 Cigarette</button> : null}
          {canProcessorView ? <button type="button" className={`filter-pill ${tab === 'processor' ? 'filter-pill-active' : ''}`} onClick={() => setTab('processor')}>⚙️ Processeur</button> : null}
          {canHistory ? <button type="button" className={`filter-pill ${tab === 'history' ? 'filter-pill-active' : ''}`} onClick={() => setTab('history')}>📚 Historique</button> : null}
          {canStats ? <button type="button" className={`filter-pill ${tab === 'stats' ? 'filter-pill-active' : ''}`} onClick={() => setTab('stats')}>📊 Stats</button> : null}
        </div>
      </section>

      {tab === 'home' ? (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="glass-card p-4 space-y-2">
            <h3 className="font-semibold text-[#ffe8ca]">📱 Tablette</h3>
            <MiniStat label="Passages jour" value={String(tabletDayState?.passages_count ?? 0)} />
            <MiniStat label="Stock kits" value={String(kitsState)} />
            <MiniStat label="Stock disqueuses" value={String(cuttersState)} />
            <MiniStat label="Argent généré" value={formatUsd(tabletGenerated)} />
            {canTabletAccess ? <button className="saas-primary-btn w-full" onClick={() => setTab('tablet')}>Ouvrir Tablette</button> : null}
          </article>
          <article className="glass-card p-4 space-y-2">
            <h3 className="font-semibold text-[#ffe8ca]">🚬 Cigarette</h3>
            <MiniStat label="Passages jour" value={String(cigaretteDayState?.passages_count ?? 0)} />
            <MiniStat label="Stock paquets" value={String(packsState)} />
            <MiniStat label="Argent généré" value={formatUsd(Number(cigaretteDayState?.total_revenue ?? 0))} />
            {canCigaretteAccess ? <button className="saas-primary-btn w-full" onClick={() => setTab('cigarette')}>Ouvrir Cigarette</button> : null}
          </article>
          <article className="glass-card p-4 space-y-2">
            <h3 className="font-semibold text-[#ffe8ca]">⚙️ Processeur</h3>
            <MiniStat label="Stock actuel" value={String(processorStockState)} />
            <MiniStat label="Produits sem." value={String(processorStatsQuick.produced)} />
            <MiniStat label="Argent généré" value={formatUsd(processorStatsQuick.revenue)} />
            {canProcessorView ? <button className="saas-primary-btn w-full" onClick={() => setTab('processor')}>Ouvrir Processeur</button> : null}
          </article>
        </section>
      ) : null}

      {tab === 'tablet' && canTabletAccess ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
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

          <article className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[#fff1dd]">📱 Passage tablette</h3>
              <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{tabletBusinessDay}</span>
            </div>

            <div className="space-y-3">
              <FieldLabel icon="👤" label="Membre" />
              <select className="saas-input !h-10" value={memberId} onChange={(event) => selectMember(event.target.value)}>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
              </select>

              {canTabletManageDaily ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div>
                    <FieldLabel icon="💵" label="Dépôt" />
                    <input className="saas-input !h-10" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
                  </div>
                  <button className="saas-primary-btn self-end !h-10 px-4" onClick={() => void saveTabletDeposit()}>Enregistrer</button>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Kits" value={String(kitsState)} />
                <MiniStat label="Disqueuses" value={String(cuttersState)} />
                <MiniStat label="Argent" value={formatUsd(tabletGenerated)} />
              </div>

              {canTabletCreatePassage ? <button className="saas-primary-btn w-full" onClick={() => void createTabletPassage()}>Valider</button> : null}
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'cigarette' && canCigaretteAccess ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
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

          <article className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[#fff1dd]">🚬 Nouveau passage cigarette</h3>
              <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{packsState} paquets</span>
            </div>

            <div className="space-y-3">
              <FieldLabel icon="👤" label="Membre" />
              <select className="saas-input !h-10" value={memberId} onChange={(event) => selectMember(event.target.value)} disabled={!canCigaretteCreateForAny}>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={`filter-pill justify-center ${cigarettePaymentMode === 'cash' ? 'filter-pill-active' : ''}`} onClick={() => setCigarettePaymentMode('cash')}>💵 Cash</button>
                <button type="button" className={`filter-pill justify-center ${cigarettePaymentMode === 'bank' ? 'filter-pill-active' : ''}`} onClick={() => setCigarettePaymentMode('bank')}>🏦 Bank</button>
              </div>

              {cigarettePaymentMode === 'cash' ? (
                <div className="rounded-xl border border-white/10 bg-[#2f1d14]/60 px-3 py-2 text-sm text-[#ffe8ca]">
                  <span className="mr-2">✅</span>Ajout direct au groupe
                </div>
              ) : (
                <div className="grid gap-2 rounded-xl border border-white/10 bg-[#2f1d14]/60 p-3 text-sm">
                  <InfoRow label="RIB" value="ZT96CO" />
                  <InfoRow label="Tel" value="8202043" />
                  <InfoRow label="statut" value="en attente" />
                </div>
              )}

              {canCigaretteCreatePassage ? <button className="saas-primary-btn w-full" onClick={() => void createCigarettePassage()}>Valider passage</button> : null}
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'processor' && canProcessorView ? (
        <section className="space-y-4">
          <article className="glass-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-[#ffe8ca]">Processeur — {tabletBusinessDay}</h3>
                <p className="text-xs text-[#efcdab]">Vente processeurs</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Stock actuel" value={String(processorStockState)} />
                <MiniStat label="Coût / bouteille" value={formatUsd(300)} />
                <MiniStat label="Prix / processeur" value={formatUsd(100)} />
                <MiniStat label="Bénéfice estimé" value={formatUsd(processorEstimate.profitAverage)} />
              </div>
            </div>
          </article>

          <div className="grid gap-4 xl:grid-cols-2">
            {canProcessorProduction ? <article className="glass-card flex h-full flex-col p-4">
              <h4 className="text-base font-semibold text-[#fff1dd]">⚙️ Production processeurs</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {[2, 4, 10, 12].map((qty) => (
                  <button key={qty} type="button" className={`filter-pill ${processorBottles === qty ? 'filter-pill-active' : ''}`} onClick={() => setProcessorBottles(qty)}>{qty} bouteilles</button>
                ))}
                <input className="saas-input !h-9 w-28" type="number" min={1} max={12} value={processorBottles} onChange={(event) => setProcessorBottles(Math.max(1, Math.min(12, Number(event.target.value || 0))))} />
              </div>
              <select className="saas-input mt-2" multiple value={processorParticipants} onChange={(event) => setProcessorParticipants(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
              </select>
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-[#efcdab]"><input type="checkbox" checked={processorBoatFee || processorBottles >= PROCESSOR_BOAT_FROM_BOTTLES} onChange={(event) => setProcessorBoatFee(event.target.checked)} /> Frais bateau (1500$)</label>
              <p className="mt-1 text-xs text-[#efcdab]">🚗/🛥️ Véhicule conseillé: <span className="font-semibold text-[#ffe8ca]">{processorEstimate.vehicleSuggested === 'boat' ? 'Bateau' : 'Voiture'}</span></p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MiniStat label="Coût matos" value={formatUsd(processorEstimate.materialCost)} />
                <MiniStat label="Frais bateau" value={formatUsd(processorEstimate.boatFee)} />
                <MiniStat label="Processeurs" value={String(processorEstimate.processors)} />
                <MiniStat label="Stock après" value={String(processorStockState + processorEstimate.processors)} />
              </div>
              <input className="saas-input mt-2 !h-9" placeholder="Frais réels" value={processorRealFee} onChange={(event) => setProcessorRealFee(event.target.value)} />
              {canProcessorCreate ? <button className="saas-primary-btn mt-3 w-full" onClick={() => void createProcessorProduction()}>Valider production</button> : null}
            </article> : null}

            {canProcessorSale ? <article className="glass-card flex h-full flex-col p-4">
              <h4 className="text-base font-semibold text-[#fff1dd]">💰 Vente processeurs</h4>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#2f1d14]/55 p-2">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#4a2f20]/60 text-lg">
                  {processorImageUrl ? <Image src={processorImageUrl} alt="Processeur" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : '⚙️'}
                </div>
                <div>
                  <p className="text-sm text-[#ffe8ca]">Item Processeur</p>
                  <p className="text-xs text-[#efcdab]">Stock actuel: <span className="font-semibold">{processorStockState}</span></p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_180px]">
                <div>
                  <FieldLabel icon="👤" label="Vendeur" />
                  <select className="saas-input !h-10" value={processorSaleMemberId} onChange={(event) => setProcessorSaleMemberId(event.target.value)}>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
                  </select>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#2f1d14]/60 px-3 py-2 text-xs text-[#efcdab]">
                  <p>Déjà vendu aujourd’hui: <b className="text-[#ffe8ca]">{processorSoldToday}</b></p>
                  <p>Restant possible: <b className="text-[#ffe8ca]">{processorRemainingToday}</b>/50</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_180px]">
                <div>
                  <FieldLabel icon="📦" label="Quantité mise en vente" />
                  <div className="flex items-center gap-2">
                    <button type="button" className="saas-ghost-btn !h-10 !px-3" onClick={() => setProcessorSaleQty((cur) => Math.max(0, cur - 1))}>-</button>
                    <input className="saas-input !h-10 text-center" type="number" min={0} max={Math.min(processorRemainingToday, processorStockState)} value={processorSaleQty} onChange={(event) => setProcessorSaleQty(Math.max(0, Math.min(processorRemainingToday, processorStockState, Number(event.target.value || 0))))} />
                    <button type="button" className="saas-ghost-btn !h-10 !px-3" onClick={() => setProcessorSaleQty((cur) => Math.min(processorRemainingToday, processorStockState, cur + 1))}>+</button>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200/20 bg-[#3a2418]/70 px-3 py-2">
                  <p className="text-[11px] uppercase text-[#efcdab]">Estimation récupérée</p>
                  <p className="text-lg font-semibold text-[#ffe8ca]">{formatUsd(processorSaleTotalEstimated)}</p>
                  <p className="text-[11px] text-[#efcdab]">50% · 100$ / processeur</p>
                </div>
              </div>

              <div className="mt-3">
                <FieldLabel icon="💵" label="Argent réel reçu" />
                <input className="saas-input !h-10" type="number" min={0} value={processorRealReceived} onChange={(event) => setProcessorRealReceived(event.target.value)} />
                <p className="mt-1 text-xs text-[#efcdab]">Ce montant est le seul ajouté à l’argent groupe.</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label="Argent groupe ajouté" value={formatUsd(processorSaleTotalReal)} />
                <MiniStat label="Stock après" value={String(Math.max(0, processorStockState - processorSaleQty))} />
              </div>
              {canProcessorCreate ? <button className="saas-primary-btn mt-3 w-full" disabled={processorSaleQty <= 0 || processorSaleQty > processorRemainingToday || processorSaleQty > processorStockState} onClick={() => void createProcessorSale()}>Valider vente</button> : null}
            </article> : null}
          </div>
        </section>
      ) : null}

      {tab === 'history' && canHistory ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <HistoryColumn title="TABLETTE" icon="📱" rows={historyColumns.tabletRows} empty="Aucun passage tablette." />
          <HistoryColumn title="CIGARETTE" icon="🚬" rows={historyColumns.cigaretteRows} empty="Aucun passage cigarette." />
          <HistoryColumn title="PROCESSEUR" icon="⚙️" rows={canProcessorLogs ? historyColumns.processorRows : []} empty={canProcessorLogs ? 'Aucun log processeur.' : 'Accès historique processeur requis.'} />
        </section>
      ) : null}

      {tab === 'stats' && canStats ? (
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
                <Stat label="Produits" value={String(activeProcessorSessions.reduce((sum, row) => sum + Number(row.operation_type === 'production' ? row.processors_count : 0), 0))} icon="⚙️" />
                <Stat label="Vendus" value={String(activeProcessorSessions.reduce((sum, row) => sum + Number(row.operation_type === 'sale' ? row.processors_count : 0), 0))} icon="📦" />
                <Stat label="Argent généré" value={formatUsd(activeProcessorSessions.reduce((sum, row) => sum + Number(row.operation_type === 'sale' ? row.real_received : 0), 0))} icon="💵" />
                <Stat label="Bénéfice net" value={formatUsd(activeProcessorSessions.reduce((sum, row) => sum + Number(row.real_profit ?? 0), 0))} icon="📈" />
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {status ? <p className="rounded-xl border border-white/10 bg-[#4a2f20]/45 px-3 py-2 text-sm text-[#efcdab]">{status}</p> : null}
    </div>
  );
}

function FieldLabel({ icon, label }: { icon: string; label: string }) {
  return <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#efcdab]"><span>{icon}</span>{label}</label>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[#efcdab]">{label}</span><span className="font-semibold text-[#ffe8ca]">{value}</span></div>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-[#3b2418]/60 px-2 py-2"><p className="text-[11px] text-[#efcdab]">{label}</p><p className="text-sm font-semibold text-[#ffe8ca]">{value}</p></div>;
}

function HistoryColumn({ title, icon, rows, empty }: { title: string; icon: string; rows: HistoryCard[]; empty: string }) {
  return (
    <article className="glass-card min-h-[360px] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-[0.08em] text-[#fff1dd]">{icon} {title}</h3>
        <span className="rounded-full border border-white/10 bg-[#3f281b]/60 px-2 py-1 text-[11px] text-[#efcdab]">{rows.length}</span>
      </div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {rows.length ? rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-white/10 bg-[#3f281b]/55 p-2.5 text-xs text-[#efcdab]">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[#ffe8ca]">{row.title}</p>
              <p className="shrink-0 text-[10px] text-[#d9b48f]">{row.meta}</p>
            </div>
            {row.lines.map((line) => <p key={line} className="mt-1 leading-relaxed">{line}</p>)}
          </article>
        )) : <p className="rounded-lg border border-white/10 bg-[#3f281b]/40 p-3 text-xs text-[#efcdab]">{empty}</p>}
      </div>
    </article>
  );
}
