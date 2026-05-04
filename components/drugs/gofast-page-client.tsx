'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '@/lib/currency';
import { SessionMemberSelector } from '@/components/shared/session-member-selector';

type Item = { id: number; name: string; image_url: string | null; quantity: number };
type Run = {
  id: number;
  created_at: string;
  user_name: string | null;
  status: 'success' | 'arrested';
  item_name: string;
  item_image: string | null;
  quantity: number;
  money_amount: number;
  lost_money: number;
  seized_quantity: number;
  stock_after: number;
  money_after: number | null;
  participants?: Array<{ id: string; label: string }>;
};

export function GoFastPageClient({
  items,
  members,
  runs,
  stats,
  canCreate,
  canArrested,
  canStats,
  canLogs
}: {
  items: Item[];
  members: Array<{ id: string; label: string }>;
  runs: Run[];
  stats: { successCount: number; arrestedCount: number; sentQty: number; seizedQty: number; moneyIn: number; moneyLost: number };
  canCreate: boolean;
  canArrested: boolean;
  canStats: boolean;
  canLogs: boolean;
}) {
  const router = useRouter();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(items[0]?.id ?? null);
  const [quantity, setQuantity] = useState<30 | 300>(30);
  const [moneyReceived, setMoneyReceived] = useState(0);
  const [arrestedOpen, setArrestedOpen] = useState(false);
  const [seizedQuantity, setSeizedQuantity] = useState(0);
  const [lostMoney, setLostMoney] = useState(0);
  const defaultMemberIds = useMemo(() => members[0] ? [members[0].id] : [], [members]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(defaultMemberIds);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);
  const memberLabelById = useMemo(() => new Map(members.map((member) => [member.id, member.label])), [members]);
  const activeMemberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const selectedMembersLabel = useMemo(() => {
    const labels = selectedMemberIds.map((id) => memberLabelById.get(id)).filter((value): value is string => Boolean(value));
    return labels.length > 0 ? labels.join(', ') : '—';
  }, [memberLabelById, selectedMemberIds]);
  const memberStats = useMemo(() => {
    const rows = new Map<string, { name: string; count: number; money: number; qty: number; last: string }>();
    for (const run of runs) {
      const participants = Array.isArray(run.participants) && run.participants.length > 0
        ? run.participants.filter((participant) => activeMemberIds.has(participant.id))
        : [];
      if (participants.length === 0) continue;
      for (const participant of participants) {
        const key = participant.id || participant.label || `unknown-${run.id}`;
        const previous = rows.get(key) ?? { name: participant.label || 'Membre', count: 0, money: 0, qty: 0, last: run.created_at };
        previous.count += 1;
        previous.money += Number(run.money_amount ?? 0);
        previous.qty += Number(run.status === 'success' ? run.quantity : 0);
        if (new Date(run.created_at).getTime() > new Date(previous.last).getTime()) previous.last = run.created_at;
        rows.set(key, previous);
      }
    }
    return Array.from(rows.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.count - a.count || b.money - a.money);
  }, [activeMemberIds, runs]);

  async function submit(action: 'success' | 'arrested') {
    setError('');
    if (!selected) return setError('Sélectionne un pochon.');
    if (selectedMemberIds.length === 0) return setError('Sélectionne au moins un membre participant.');
    const qty = action === 'success' ? quantity : Math.max(0, seizedQuantity);
    const money = action === 'success' ? Math.max(0, moneyReceived) : Math.max(0, lostMoney);
    if (qty <= 0) return setError('Quantité invalide.');
    if (qty > Number(selected.quantity ?? 0)) return setError('Stock insuffisant pour ce pochon.');
    if (action === 'success' && money <= 0) return setError('Argent reçu invalide.');

    setSaving(true);
    const res = await fetch('/api/drugs/gofast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        item_id: selected.id,
        quantity,
        money_amount: moneyReceived,
        seized_quantity: seizedQuantity,
        lost_money: lostMoney,
        participant_ids: selectedMemberIds
      })
    });
    setSaving(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ message: 'Validation impossible.' }));
      return setError(payload.message ?? 'Validation impossible.');
    }

    setMoneyReceived(0);
    setSeizedQuantity(0);
    setLostMoney(0);
    setArrestedOpen(false);
    setSelectedMemberIds(defaultMemberIds);
    router.refresh();
  }

  function resetDraft() {
    setError('');
    setMoneyReceived(0);
    setSeizedQuantity(0);
    setLostMoney(0);
    setQuantity(30);
    setArrestedOpen(false);
    setSelectedMemberIds(defaultMemberIds);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Pochons disponibles</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className={`rounded-xl border p-2 text-left ${selectedItemId === item.id ? 'border-amber-200/60 bg-[#5a3a27]/70' : 'border-white/10 bg-[#3a2519]/55'}`}>
                <div className="flex items-center gap-2">
                  <div className="h-11 w-11 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                    {item.image_url ? <Image src={item.image_url} alt={item.name} width={44} height={44} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs">📦</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#ffe8ca]">{item.name}</p>
                    <p className="text-[11px] text-[#efcdab]">Stock: {item.quantity}</p>
                    <span className="inline-flex rounded-full border border-sky-200/30 bg-sky-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sky-100">Pochon</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="glass-card space-y-3 p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Valider un GoFast</h3>
          <p className="text-xs text-[#efcdab]">Item sélectionné: <span className="font-semibold text-[#ffe8ca]">{selected?.name ?? '—'}</span></p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`filter-pill ${quantity === 30 ? 'filter-pill-active' : ''}`} onClick={() => setQuantity(30)}>30 pochons</button>
            <button type="button" className={`filter-pill ${quantity === 300 ? 'filter-pill-active' : ''}`} onClick={() => setQuantity(300)}>300 pochons</button>
          </div>
          <label className="block text-xs text-[#efcdab]">Argent reçu</label>
          <input className="saas-input" value={moneyReceived} onChange={(event) => setMoneyReceived(Math.max(0, Number(event.target.value || 0)))} />
          <SessionMemberSelector
            members={members}
            selectedMemberIds={selectedMemberIds}
            onSelectedMemberIdsChange={setSelectedMemberIds}
            groupMode={false}
            onGroupModeChange={() => {}}
            groupLabel="🚫 Groupe"
            membersLabel="👥 Participants"
            helperText="Sélection multiple obligatoire pour les participants GoFast."
            selectedHint="Participants sélectionnés"
            groupHint="Le mode Groupe est désactivé pour GoFast : sélectionne au moins un participant."
          />
          <p className="text-[11px] text-[#efcdab]">Participants: <span className="font-semibold text-[#ffe8ca]">{selectedMembersLabel}</span></p>

          <div className="grid grid-cols-2 gap-2">
            {canCreate ? <button type="button" className="saas-primary-btn" disabled={saving} onClick={() => void submit('success')}>Valider GoFast</button> : <div className="saas-ghost-btn text-center opacity-60">Validation bloquée</div>}
            <button type="button" className="saas-ghost-btn" onClick={resetDraft}>Annuler</button>
          </div>

          {canArrested ? <button type="button" className="saas-ghost-btn w-full" onClick={() => setArrestedOpen((cur) => !cur)}>🚔 GoFast arrêté</button> : null}
          {arrestedOpen ? (
            <div className="space-y-2 rounded-xl border border-rose-200/20 bg-rose-500/10 p-3">
              <p className="text-sm font-semibold text-[#ffe8ca]">Déclarer un GoFast arrêté</p>
              <label className="block text-xs text-[#efcdab]">Quantité saisie</label>
              <input className="saas-input" value={seizedQuantity} onChange={(event) => setSeizedQuantity(Math.max(0, Number(event.target.value || 0)))} />
              <label className="block text-xs text-[#efcdab]">Argent perdu</label>
              <input className="saas-input" value={lostMoney} onChange={(event) => setLostMoney(Math.max(0, Number(event.target.value || 0)))} />
              <button type="button" className="saas-primary-btn w-full" disabled={saving} onClick={() => void submit('arrested')}>Valider GoFast arrêté</button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </article>
      </section>

      {canStats ? (
        <section className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Réussis" value={String(stats.successCount)} icon="✅" />
            <StatCard label="Arrêtés" value={String(stats.arrestedCount)} icon="🚔" />
            <StatCard label="Pochons envoyés" value={String(stats.sentQty)} icon="📦" />
            <StatCard label="Pochons saisis" value={String(stats.seizedQty)} icon="⛔" />
            <StatCard label="Argent généré" value={formatUsd(stats.moneyIn)} icon="💵" />
            <StatCard label="Net GoFast" value={formatUsd(stats.moneyIn - stats.moneyLost)} icon="📈" />
          </div>
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Stats membres GoFast</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-[#efcdab]">
                <thead className="text-[#ffe8ca]">
                  <tr>
                    <th className="px-2 py-1">Membre</th>
                    <th className="px-2 py-1">GoFast</th>
                    <th className="px-2 py-1">Argent généré</th>
                    <th className="px-2 py-1">Pochons livrés</th>
                    <th className="px-2 py-1">Dernière participation</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((entry) => (
                    <tr key={entry.key} className="border-t border-white/10">
                      <td className="px-2 py-1 text-[#ffe8ca]">{entry.name}</td>
                      <td className="px-2 py-1">{entry.count}</td>
                      <td className="px-2 py-1">{formatUsd(entry.money)}</td>
                      <td className="px-2 py-1">{entry.qty}</td>
                      <td className="px-2 py-1">{new Date(entry.last).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {memberStats.length === 0 ? <p className="pt-2 text-xs text-[#efcdab]">Aucune donnée membre GoFast.</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {canLogs ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique GoFast</h3>
          <div className="mt-3 space-y-2">
            {runs.map((run) => (
              <article key={run.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-sm text-[#f1d2ad]">
                <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <p className="font-semibold text-[#ffe8ca]">{run.status === 'success' ? '✅ Réussi' : '🚔 Arrêté'}</p>
                  <p>{run.user_name || 'Groupe'} — {run.item_name} x{run.quantity}</p>
                  <p className="text-xs">{new Date(run.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <p className="mt-1 text-xs text-[#efcdab]">Participants: {(run.participants && run.participants.length > 0) ? run.participants.map((entry) => entry.label).join(', ') : (run.user_name || 'Groupe')}</p>
                <p className="mt-1 text-xs">{run.status === 'success' ? `Argent reçu: ${formatUsd(run.money_amount)}` : `Argent perdu: ${formatUsd(run.lost_money)}`} · Stock après: {run.stock_after} · Solde après: {run.money_after != null ? formatUsd(run.money_after) : '—'}</p>
              </article>
            ))}
            {runs.length === 0 ? <p className="text-sm text-[#efcdab]">Aucun GoFast enregistré.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3">
      <p className="text-xs text-[#efcdab]">{icon} {label}</p>
      <p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p>
    </article>
  );
}
