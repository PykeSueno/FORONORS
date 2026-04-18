'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CIGARETTE_REVENUE, CIGARETTE_SALE_QTY } from '@/lib/cigarette';
import { formatUsd } from '@/lib/currency';

type CigaretteDay = {
  id: number;
  business_day: string;
  chest_amount: number;
  passages_count: number;
  total_revenue: number;
  packs_sold: number;
} | null;

type CigarettePassage = {
  id: number;
  member_label: string;
  quantity_sold: number;
  revenue_amount: number;
  before_packs: number;
  after_packs: number;
  before_chest: number;
  after_chest: number;
  before_group_cash: number;
  after_group_cash: number;
  status: string;
  created_at: string;
};

export function CigarettePageClient({
  day,
  businessDay,
  members,
  passages,
  groupCash,
  packsInStock,
  canCreatePassage,
  canCreateForAny,
  canManageDaily,
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
  canManageDaily: boolean;
  canHistoryView: boolean;
  defaultMemberId: string;
  defaultMemberLabel: string;
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [error, setError] = useState('');
  const [statusFeedback, setStatusFeedback] = useState('');

  const isAllowedHour = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 4 && hour < 20;
  }, []);

  async function createPassage() {
    setError('');
    const response = await fetch('/api/cigarette/passages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel })
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Passage cigarette impossible.');
      return;
    }
    setStatusFeedback('Passage cigarette validé.');
    setTimeout(() => setStatusFeedback(''), 1400);
    router.refresh();
  }

  async function resetDay() {
    setError('');
    const response = await fetch('/api/cigarette/day', { method: 'PATCH' });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Réinitialisation impossible.');
      return;
    }
    setStatusFeedback('Journée cigarette réinitialisée.');
    setTimeout(() => setStatusFeedback(''), 1600);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1dd]">A. État journée Cigarette ({businessDay})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="🚬" tone="from-[#825128]/45 to-[#5a3119]/20" label="Paquets vendus" value={String(day?.packs_sold ?? 0)} />
          <Stat icon="🧾" tone="from-violet-700/40 to-violet-500/10" label="Passages" value={String(day?.passages_count ?? 0)} />
          <Stat icon="🏦" tone="from-amber-700/40 to-amber-500/10" label="Dépôt Cigarette" value={formatUsd(Number(day?.chest_amount ?? 0))} />
          <Stat icon="💵" tone="from-emerald-700/40 to-emerald-500/10" label="Total gagné" value={formatUsd(Number(day?.total_revenue ?? 0))} />
          <Stat icon="📦" tone="from-cyan-700/40 to-cyan-500/10" label="Paquets restants" value={String(packsInStock)} />
          <Stat icon="💰" tone="from-green-700/40 to-green-500/10" label="Argent groupe réel" value={formatUsd(groupCash)} />
          <Stat icon="🕓" tone="from-[#70401f]/45 to-[#5a3119]/20" label="Fenêtre passage" value="04h → 20h" />
          <Stat icon={isAllowedHour ? '✅' : '⛔'} tone="from-[#6f4424]/45 to-[#3a2418]/20" label="Statut horaire" value={isAllowedHour ? 'Ouverte' : 'Fermée'} />
        </div>
      </section>

      {canCreatePassage ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">B. Passage Cigarette</h3>
          <p className="mt-1 text-xs text-[#efcdab]">Chaque passage retire {CIGARETTE_SALE_QTY} paquets et ajoute {formatUsd(CIGARETTE_REVENUE)} au dépôt Cigarette + au groupe.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
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
            <button className="saas-primary-btn" onClick={() => void createPassage()}>Valider passage</button>
          </div>
          <p className="mt-1 text-[11px] text-[#efcdab]">Membre sélectionné: <span className="font-semibold text-[#ffe8ca]">{memberLabel}</span></p>
          {!canCreateForAny ? <p className="mt-1 text-[11px] text-[#efcdab]">Permission manquante pour sélectionner un autre membre.</p> : null}

          {canManageDaily ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-[#2f1d14]/40 p-3">
              <p className="text-xs text-[#efcdab]">Gestion journée</p>
              <button className="saas-ghost-btn mt-2" onClick={() => void resetDay()}>Réinitialiser journée Cigarette</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {statusFeedback ? <p className="rounded-xl border border-white/10 bg-[#4a2f20]/45 px-3 py-2 text-sm text-[#efcdab]">{statusFeedback}</p> : null}

      {canHistoryView ? <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">C. Historique passages Cigarette</h3>
        <div className="mt-2 space-y-2">
          {passages.map((passage) => (
            <article key={passage.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">👤 {passage.member_label}</p>
                <p className="text-xs text-[#efcdab]">{new Date(passage.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">🚬 Paquets {passage.before_packs} → {passage.after_packs}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">🏦 Dépôt {formatUsd(passage.before_chest)} → {formatUsd(passage.after_chest)}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">💵 Groupe {formatUsd(passage.before_group_cash)} → {formatUsd(passage.after_group_cash)}</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">🧾 Qté {passage.quantity_sold} · Recette {formatUsd(passage.revenue_amount)} · État {passage.status}</p>
              </div>
            </article>
          ))}
          {passages.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucun passage cigarette pour la journée.</p> : null}
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
