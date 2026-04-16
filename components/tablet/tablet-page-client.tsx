'use client';

import { useState } from 'react';

type Day = {
  id: number;
  business_day: string;
  deposited_amount: number;
  chest_amount: number;
  passages_count: number;
  kits_added: number;
  cutters_added: number;
} | null;

type Passage = {
  id: number;
  member_label: string;
  before_cash: number;
  after_cash: number;
  before_kits: number;
  after_kits: number;
  before_cutters: number;
  after_cutters: number;
  created_at: string;
};

export function TabletPageClient({ day, businessDay, members, passages, groupCash, kitsInStock, cuttersInStock, canManageDaily, canCreatePassage, defaultMemberId, defaultMemberLabel }: { day: Day; businessDay: string; members: Array<{ id: string; name: string; username: string }>; passages: Passage[]; groupCash: number; kitsInStock: number; cuttersInStock: number; canManageDaily: boolean; canCreatePassage: boolean; defaultMemberId: string; defaultMemberLabel: string }) {
  const [deposit, setDeposit] = useState(String(day?.deposited_amount ?? 4000));
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [error, setError] = useState('');

  async function saveDeposit() {
    const response = await fetch('/api/tablet/day', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deposited_amount: Number(deposit) }) });
    if (!response.ok) {
      setError('Dépôt impossible.');
      return;
    }
    window.location.reload();
  }

  async function createPassage() {
    const response = await fetch('/api/tablet/passages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel }) });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Passage impossible.');
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1dd]">Journée tablette ({businessDay})</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-7">
          <Stat icon="💰" tone="from-emerald-700/40 to-emerald-500/10" label="Dépôt restant" value={`${day?.chest_amount ?? 0}$`} />
          <Stat icon="🏦" tone="from-amber-700/40 to-amber-500/10" label="Dépôt matin" value={`${day?.deposited_amount ?? 0}$`} />
          <Stat icon="💵" tone="from-green-700/40 to-green-500/10" label="Argent groupe réel" value={`${groupCash}$`} />
          <Stat icon="🧰" tone="from-cyan-700/40 to-cyan-500/10" label="Kits stock réel" value={String(kitsInStock)} />
          <Stat icon="🪚" tone="from-sky-700/40 to-sky-500/10" label="Disqueuses stock réel" value={String(cuttersInStock)} />
          <Stat icon="🧾" tone="from-violet-700/40 to-violet-500/10" label="Passages" value={String(day?.passages_count ?? 0)} />
          <Stat icon="➕🧰" tone="from-teal-700/40 to-teal-500/10" label="Kits ajoutés" value={String(day?.kits_added ?? 0)} />
          <Stat icon="➕🪚" tone="from-blue-700/40 to-blue-500/10" label="Disqueuses ajoutées" value={String(day?.cutters_added ?? 0)} />
        </div>
      </section>

      {canManageDaily ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Dépôt du matin (8h)</h3>
          <p className="mt-1 text-xs text-[#efcdab]">Allocation interne uniquement (ne modifie pas le solde réel du groupe).</p>
          <div className="mt-2 flex gap-2">
            <input className="saas-input w-full" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <button className="saas-primary-btn" onClick={() => void saveDeposit()}>Enregistrer</button>
          </div>
        </section>
      ) : null}

      {canCreatePassage ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Enregistrer un passage tablette</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
            <select className="saas-input" value={memberId} onChange={(e) => { setMemberId(e.target.value); const m = members.find((entry) => entry.id === e.target.value); setMemberLabel(m ? (m.name || m.username) : 'Groupe'); }}>
              <option value="">Groupe</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            <button className="saas-primary-btn" onClick={() => void createPassage()}>Valider passage</button>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Historique passages</h3>
        <div className="mt-2 space-y-2">
          {passages.map((passage) => (
            <article key={passage.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <p className="font-medium">👤 {passage.member_label} · {new Date(passage.created_at).toLocaleString('fr-FR')}</p>
              <p className="mt-1">💰 {passage.before_cash}$ → {passage.after_cash}$</p>
              <p>🧰 Kits {passage.before_kits} → {passage.after_kits} · 🛠️ Disqueuses {passage.before_cutters} → {passage.after_cutters}</p>
            </article>
          ))}
        </div>
      </section>
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
