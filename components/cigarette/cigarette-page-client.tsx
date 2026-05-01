'use client';

import { useEffect, useMemo, useState } from 'react';
import { CIGARETTE_SALE_QTY, getCigaretteWindowLabel, isCigarettePassageHourAllowed } from '@/lib/cigarette';
import { formatUsd } from '@/lib/currency';

type CigaretteDay = {
  id: number;
  business_day: string;
  chest_amount: number;
  passages_count: number;
  total_revenue: number;
  packs_sold: number;
  packs_deposit_initial?: number;
  packs_deposit_remaining?: number;
} | null;

type CigarettePassage = {
  id: number;
  member_label: string;
  quantity_sold: number;
  revenue_amount: number;
  before_packs: number;
  after_packs: number;
  before_deposit_packs?: number;
  after_deposit_packs?: number;
  before_chest: number;
  after_chest: number;
  before_group_cash: number;
  after_group_cash: number;
  status: string;
  created_at: string;
};

function passageStatusLabel(status: string) {
  if (status === 'pending_bank') return 'Bank en attente';
  if (status === 'received_bank') return 'Bank reçu';
  return 'Cash reçu';
}

function passagePaymentMode(status: string) {
  return status === 'pending_bank' || status === 'received_bank' ? 'Bank' : 'Cash';
}

export function CigarettePageClient({
  day,
  businessDay,
  members,
  passages,
  groupCash,
  packsInStock,
  canCreatePassage,
  canCreateForAny,
  canHistoryView,
  defaultMemberId,
  defaultMemberLabel
}: {
  day: CigaretteDay;
  businessDay: string;
  members: Array<{ id: string; name: string; username: string }>;
  passages: CigarettePassage[];
  groupCash: number;
  packsInStock: number;
  canCreatePassage: boolean;
  canCreateForAny: boolean;
  canHistoryView: boolean;
  defaultMemberId: string;
  defaultMemberLabel: string;
}) {
  const [dayState, setDayState] = useState(day);
  const [passagesState, setPassagesState] = useState(passages);
  const [packsInStockState, setPacksInStockState] = useState(packsInStock);
  const [groupCashState, setGroupCashState] = useState(groupCash);
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [error, setError] = useState('');
  const [statusFeedback, setStatusFeedback] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash'|'bank'>('cash');

  useEffect(() => {
    setDayState(day);
    setPassagesState(passages);
    setPacksInStockState(packsInStock);
    setGroupCashState(groupCash);
  }, [day, passages, packsInStock, groupCash]);

  const isAllowedHour = useMemo(() => isCigarettePassageHourAllowed(), []);

  async function createPassage() {
    setError('');
    const response = await fetch('/api/cigarette/passages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel, payment_mode: paymentMode })
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Passage cigarette impossible.');
      return;
    }
    const data = (await response.json()) as {
      passage?: CigarettePassage | null;
      day?: (NonNullable<CigaretteDay> & { packs_deposit_remaining?: number }) | null;
      packsInStock?: number;
      groupCash?: number;
    };
    if (data.passage) setPassagesState((current) => [data.passage as CigarettePassage, ...current]);
    if (data.day) setDayState((current) => ({ ...(current ?? {}), ...data.day } as NonNullable<CigaretteDay>));
    if (typeof data.packsInStock === 'number') setPacksInStockState(data.packsInStock);
    if (typeof data.groupCash === 'number') setGroupCashState(data.groupCash);
    setStatusFeedback(paymentMode === 'bank' ? 'Passage bank enregistré. Virement requis.' : 'Passage cash validé.');
    setTimeout(() => setStatusFeedback(''), 1400);
  }

  async function receiveBankPassage(passageId: number) {
    setError('');
    const response = await fetch(`/api/cigarette/passages/${passageId}/receive`, { method: 'POST' });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Validation virement impossible.');
      return;
    }
    const payload = (await response.json()) as { after?: number };
    setPassagesState((current) => current.map((entry) => (
      entry.id === passageId ? { ...entry, status: 'received_bank' } : entry
    )));
    if (typeof payload.after === 'number') setGroupCashState(payload.after);
    setStatusFeedback('Virement reçu validé.');
    setTimeout(() => setStatusFeedback(''), 1400);
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1dd]">A. État journée Cigarette ({businessDay})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="🚬" tone="from-[#825128]/45 to-[#5a3119]/20" label="Paquets vendus" value={String(dayState?.packs_sold ?? 0)} />
          <Stat icon="🧾" tone="from-violet-700/40 to-violet-500/10" label="Passages" value={String(dayState?.passages_count ?? 0)} />
          <Stat icon="🏦" tone="from-amber-700/40 to-amber-500/10" label="Dépôt Cigarette" value={formatUsd(Number(dayState?.chest_amount ?? 0))} />
          <Stat icon="💵" tone="from-emerald-700/40 to-emerald-500/10" label="Total gagné" value={formatUsd(Number(dayState?.total_revenue ?? 0))} />
          <Stat icon="📦" tone="from-cyan-700/40 to-cyan-500/10" label="Paquets restants" value={String(packsInStockState)} />
          <Stat icon="🧮" tone="from-orange-700/40 to-orange-500/10" label="Dépôt paquets restant" value={String(dayState?.packs_deposit_remaining ?? 0)} />
          <Stat icon="💰" tone="from-green-700/40 to-green-500/10" label="Argent groupe réel" value={formatUsd(groupCashState)} />
          <Stat icon="🕓" tone="from-[#70401f]/45 to-[#5a3119]/20" label="Fenêtre passage" value={getCigaretteWindowLabel()} />
          <Stat icon={isAllowedHour ? '✅' : '⛔'} tone="from-[#6f4424]/45 to-[#3a2418]/20" label="Statut horaire" value={isAllowedHour ? 'Ouverte' : 'Fermée'} />
        </div>
      </section>

      {canCreatePassage ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">B. Passage Cigarette</h3>
          <p className="mt-1 text-xs text-[#efcdab]">Chaque passage retire {CIGARETTE_SALE_QTY} paquets. Mode Cash: argent ajouté au groupe immédiatement. Mode Bank: en attente de virement.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <select
              className="saas-input"
              value={memberId}
              onChange={(event) => {
                setMemberId(event.target.value);
                const member = members.find((entry) => entry.id === event.target.value);
                setMemberLabel(member ? (member.name || member.username) : 'Membre');
              }}
              disabled={!canCreateForAny}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name || member.username}</option>
              ))}
            </select>
            <select className="saas-input" value={paymentMode} onChange={(e)=>setPaymentMode(e.target.value as 'cash'|'bank')}><option value="cash">Cash</option><option value="bank">Bank</option></select><button className="saas-primary-btn" onClick={() => void createPassage()}>Valider passage</button>
          </div>
          {paymentMode === 'bank' ? <p className="mt-1 text-[11px] text-amber-200">⚠️ Le membre doit faire un virement. L’argent ne sera ajouté qu’au clic “Virement reçu”.</p> : null}
          <p className="mt-1 text-[11px] text-[#efcdab]">Membre sélectionné: <span className="font-semibold text-[#ffe8ca]">{memberLabel}</span></p>
          {!canCreateForAny ? <p className="mt-1 text-[11px] text-[#efcdab]">Permission manquante pour sélectionner un autre membre.</p> : null}

          <p className="mt-2 text-[11px] text-[#efcdab]">Reset automatique à 04h00. Aucun reset manuel requis.</p>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {statusFeedback ? <p className="rounded-xl border border-white/10 bg-[#4a2f20]/45 px-3 py-2 text-sm text-[#efcdab]">{statusFeedback}</p> : null}

      {canHistoryView ? <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">C. Historique passages Cigarette</h3>
        <div className="mt-2 space-y-2">
          {passagesState.map((passage) => (
            <article key={passage.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">👤 {passage.member_label}</p>
                <p className="text-xs text-[#efcdab]">{new Date(passage.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">🚬 Paquets {passage.before_packs} → {passage.after_packs}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">📚 Dépôt paquets {passage.before_deposit_packs ?? '—'} → {passage.after_deposit_packs ?? '—'}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">🏦 Dépôt {formatUsd(passage.before_chest)} → {formatUsd(passage.after_chest)}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">💵 Groupe {formatUsd(passage.before_group_cash)} → {formatUsd(passage.after_group_cash)}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">💵 Montant {formatUsd(passage.revenue_amount)} · Mode {passagePaymentMode(passage.status)} · Statut {passageStatusLabel(passage.status)}</p>
                {passage.status === 'pending_bank' ? <button className='saas-ghost-btn' onClick={() => void receiveBankPassage(passage.id)}>Virement reçu</button> : null}
              </div>
            </article>
          ))}
          {passagesState.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucun passage cigarette pour la journée.</p> : null}
        </div>
      </section> : null}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl border border-white/15 bg-gradient-to-br ${tone} p-3`}>
      <p className="text-xs text-[#efcbab]">{icon} {label}</p>
      <p className="mt-1 text-lg font-semibold text-[#fff1dd]">{value}</p>
    </div>
  );
}
