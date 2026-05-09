'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

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

export function TabletPageClient({ day, businessDay, members, passages, groupCash, kitsInStock, cuttersInStock, canManageDaily, canCreatePassage, canViewWebhook, canEditWebhook, webhookConfigured, defaultMemberId, defaultMemberLabel }: { day: Day; businessDay: string; members: Array<{ id: string; name: string; username: string }>; passages: Passage[]; groupCash: number; kitsInStock: number; cuttersInStock: number; canManageDaily: boolean; canCreatePassage: boolean; canViewWebhook: boolean; canEditWebhook: boolean; webhookConfigured: boolean; defaultMemberId: string; defaultMemberLabel: string }) {
  const router = useRouter();
  const [deposit, setDeposit] = useState(String(day?.deposited_amount ?? 4000));
  const [dayState, setDayState] = useState<Day>(day);
  const [passagesState, setPassagesState] = useState<Passage[]>(passages);
  const [groupCashState, setGroupCashState] = useState(groupCash);
  const [kitsState, setKitsState] = useState(kitsInStock);
  const [cuttersState, setCuttersState] = useState(cuttersInStock);
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [error, setError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookReady, setWebhookReady] = useState(webhookConfigured);
  const [webhookMessage, setWebhookMessage] = useState('');
  const [webhookBusy, setWebhookBusy] = useState(false);
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  async function saveDeposit() {
    const response = await fetch('/api/tablet/day', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deposited_amount: Number(deposit) }) });
    if (!response.ok) {
      setError('Dépôt impossible.');
      return;
    }
    const payload = (await response.json()) as { day?: Day };
    if (payload.day) setDayState(payload.day);
    else router.refresh();
  }

  async function createPassage() {
    const response = await fetch('/api/tablet/passages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_user_id: memberId, member_label: memberLabel }) });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Passage impossible.');
      return;
    }
    const payload = (await response.json()) as { passage?: Passage; day?: Day; groupCash?: number; kitsInStock?: number; cuttersInStock?: number };
    if (payload.passage) setPassagesState((current) => [payload.passage as Passage, ...current]);
    if (payload.day) setDayState(payload.day);
    if (typeof payload.groupCash === 'number') setGroupCashState(payload.groupCash);
    if (typeof payload.kitsInStock === 'number') setKitsState(payload.kitsInStock);
    if (typeof payload.cuttersInStock === 'number') setCuttersState(payload.cuttersInStock);
    if (!payload.passage) router.refresh();
  }

  async function saveWebhook() {
    setWebhookBusy(true);
    setWebhookMessage('');
    const response = await fetch('/api/tablet/webhook', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhookUrl }) });
    setWebhookBusy(false);
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setWebhookMessage(data.message ?? 'Configuration webhook impossible.');
      return;
    }
    const payload = (await response.json()) as { configured?: boolean };
    setWebhookReady(Boolean(payload.configured));
    setWebhookUrl('');
    setWebhookMessage('Webhook enregistré.');
  }

  async function testWebhook() {
    setWebhookBusy(true);
    setWebhookMessage('');
    const response = await fetch('/api/tablet/webhook/test', { method: 'POST' });
    setWebhookBusy(false);
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setWebhookMessage(data.message ?? 'Test webhook impossible.');
      return;
    }
    setWebhookMessage('Test envoyé.');
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1dd]">Journée tablette ({businessDay})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="💰" tone="from-emerald-700/40 to-emerald-500/10" label="Dépôt restant" value={`${dayState?.chest_amount ?? 0}$`} />
          <Stat icon="🏦" tone="from-amber-700/40 to-amber-500/10" label="Dépôt matin" value={`${dayState?.deposited_amount ?? 0}$`} />
          <Stat icon="💵" tone="from-green-700/40 to-green-500/10" label="Argent groupe réel" value={`${groupCashState}$`} />
          <Stat icon="🧰" tone="from-cyan-700/40 to-cyan-500/10" label="Kits stock réel" value={String(kitsState)} />
          <Stat icon="🪚" tone="from-sky-700/40 to-sky-500/10" label="Disqueuses stock réel" value={String(cuttersState)} />
          <Stat icon="🧾" tone="from-violet-700/40 to-violet-500/10" label="Passages" value={String(dayState?.passages_count ?? 0)} />
          <Stat icon="➕🧰" tone="from-teal-700/40 to-teal-500/10" label="Kits ajoutés" value={String(dayState?.kits_added ?? 0)} />
          <Stat icon="➕🪚" tone="from-blue-700/40 to-blue-500/10" label="Disqueuses ajoutées" value={String(dayState?.cutters_added ?? 0)} />
        </div>
      </section>

      {canManageDaily ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">🏦 Dépôt du matin (8h)</h3>
          <p className="mt-1 text-xs text-[#efcdab]">Allocation interne uniquement (ne modifie pas le solde réel du groupe).</p>
          <div className="mt-2 flex gap-2">
            <input className="saas-input w-full" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <button className="saas-primary-btn" onClick={() => void saveDeposit()}>Enregistrer</button>
          </div>
        </section>
      ) : null}

      {canCreatePassage ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">🧾 Enregistrer un passage tablette</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
            <select className="saas-input" value={memberId} onChange={(e) => { setMemberId(e.target.value); const m = membersById.get(e.target.value); setMemberLabel(m ? (m.name || m.username) : 'Groupe'); }}>
              <option value="">Groupe</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            <button className="saas-primary-btn" onClick={() => void createPassage()}>Valider passage</button>
          </div>
          <p className="mt-1 text-[11px] text-[#efcdab]">Membre sélectionné: <span className="font-semibold text-[#ffe8ca]">{memberLabel || 'Groupe'}</span></p>
        </section>
      ) : null}

      {canViewWebhook ? (
        <section className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#fff1dd]">Webhook Tablette Discord</h3>
              <p className="mt-1 text-xs text-[#efcdab]">Statut webhook : <span className={webhookReady ? 'font-semibold text-emerald-200' : 'font-semibold text-amber-200'}>{webhookReady ? 'configuré' : 'non configuré'}</span></p>
            </div>
            {canEditWebhook ? <button className="saas-ghost-btn" disabled={!webhookReady || webhookBusy} onClick={() => void testWebhook()}>Tester webhook</button> : null}
          </div>
          {canEditWebhook ? (
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                className="saas-input"
                type="password"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder={webhookReady ? 'Webhook déjà configuré - coller une nouvelle URL pour remplacer' : 'URL webhook Discord'}
                autoComplete="off"
              />
              <button className="saas-primary-btn" disabled={webhookBusy} onClick={() => void saveWebhook()}>Enregistrer</button>
            </div>
          ) : null}
          {webhookMessage ? <p className="mt-2 text-xs text-[#efcdab]">{webhookMessage}</p> : null}
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">📚 Historique passages</h3>
        <div className="mt-2 space-y-2">
          {passagesState.map((passage) => (
            <article key={passage.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">👤 {passage.member_label}</p>
                <p className="text-xs text-[#efcdab]">{new Date(passage.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">💰 {passage.before_cash}$ → {passage.after_cash}$</p>
                <p className="rounded-lg border border-white/10 bg-[#2c1a12]/50 px-2 py-1">🧰 {passage.before_kits} → {passage.after_kits} · 🛠️ {passage.before_cutters} → {passage.after_cutters}</p>
              </div>
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
