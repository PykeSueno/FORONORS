'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '@/lib/currency';

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
};

export function GoFastPageClient({
  items,
  runs,
  stats,
  canCreate,
  canArrested,
  canStats,
  canLogs
}: {
  items: Item[];
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);

  async function submit(action: 'success' | 'arrested') {
    setError('');
    if (!selected) return setError('Sélectionne un pochon.');
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
        lost_money: lostMoney
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
    router.refresh();
  }

  function resetDraft() {
    setError('');
    setMoneyReceived(0);
    setSeizedQuantity(0);
    setLostMoney(0);
    setQuantity(30);
    setArrestedOpen(false);
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
        <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Réussis" value={String(stats.successCount)} icon="✅" />
          <StatCard label="Arrêtés" value={String(stats.arrestedCount)} icon="🚔" />
          <StatCard label="Pochons envoyés" value={String(stats.sentQty)} icon="📦" />
          <StatCard label="Pochons saisis" value={String(stats.seizedQty)} icon="⛔" />
          <StatCard label="Argent généré" value={formatUsd(stats.moneyIn)} icon="💵" />
          <StatCard label="Net GoFast" value={formatUsd(stats.moneyIn - stats.moneyLost)} icon="📈" />
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
