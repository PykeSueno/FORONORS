'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { CompactActionField, CompactField, CompactLineGrid, QuantityStepper, RemoveLineButton } from '@/components/shared/line-controls';

type Item = { id: number; name: string; image_url: string | null; quantity: number; buy_price?: number; sell_price?: number; category_key?: string | null; type_key?: string | null };
type LineKind = 'buy' | 'sell';
type FourLine = { item_id: number; item_name: string; item_image_url?: string | null; movement_kind: LineKind; quantity: number; unit_price: number };
type FourTx = {
  id: number;
  counterparty: string | null;
  status?: 'validated' | 'canceled';
  cancel_reason?: string | null;
  created_by?: string | null;
  total_purchases: number;
  total_sales: number;
  profit_loss: number;
  created_at: string;
  four_transaction_lines: Array<{ id: number; item_id: number; item_name: string; movement_kind: LineKind; quantity: number; unit_price: number; total_amount: number }>;
};

function isAllowedFourItem(item: Item) {
  const name = item.name.toLowerCase();
  const category = (item.category_key ?? '').toLowerCase();
  const type = (item.type_key ?? '').toLowerCase();
  if (category === 'objects') return true;
  if (name.includes('kit')) return true;
  if (name.includes('disqueuse')) return true;
  return category === 'drugs' && type === 'bag';
}

export function FourPageClient({ items, initialTransactions, canCreate, canEditOwn, canEditAny, canCancelOwn, canCancelAny, currentUserId }: {
  items: Item[];
  initialTransactions: FourTx[];
  canCreate: boolean;
  canEditOwn: boolean;
  canEditAny: boolean;
  canCancelOwn: boolean;
  canCancelAny: boolean;
  currentUserId: string;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [query, setQuery] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [draftKind, setDraftKind] = useState<LineKind>('buy');
  const [draftLines, setDraftLines] = useState<FourLine[]>([]);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const availableItems = useMemo(
    () => items.filter(isAllowedFourItem).filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );
  const draftTotals = useMemo(() => {
    const purchases = draftLines.filter((line) => line.movement_kind === 'buy').reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
    const sales = draftLines.filter((line) => line.movement_kind === 'sell').reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
    return { purchases, sales, profit: sales - purchases };
  }, [draftLines]);

  function upsertLine(item: Item) {
    setDraftLines((current) => {
      const idx = current.findIndex((line) => line.item_id === item.id && line.movement_kind === draftKind);
      const unitPrice = draftKind === 'buy' ? Number(item.buy_price ?? 0) : Number(item.sell_price ?? 0);
      if (idx >= 0) return current.map((line, i) => i === idx ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { item_id: item.id, item_name: item.name, item_image_url: item.image_url, movement_kind: draftKind, quantity: 1, unit_price: unitPrice }];
    });
  }

  function canManage(tx: FourTx, mode: 'edit' | 'cancel') {
    if (mode === 'edit') return canEditAny || (canEditOwn && tx.created_by === currentUserId);
    return canCancelAny || (canCancelOwn && tx.created_by === currentUserId);
  }

  async function reloadTransactions() {
    const res = await fetch('/api/four/transactions', { cache: 'no-store' });
    if (!res.ok) return;
    const payload = await res.json() as { transactions: FourTx[] };
    setTransactions(payload.transactions ?? []);
  }

  async function submit() {
    setError('');
    if (draftLines.length === 0) return setError('Ajoute au moins une ligne.');
    const payload = { counterparty, lines: draftLines.map((line) => ({ item_id: line.item_id, movement_kind: line.movement_kind, quantity: line.quantity, unit_price: line.unit_price })) };
    const res = await fetch('/api/four/transactions', {
      method: editingTxId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingTxId ? { transaction_id: editingTxId, ...payload } : payload)
    });
    if (!res.ok) return setError((await res.json()).message ?? 'Validation impossible.');
    setDraftLines([]);
    setCounterparty('');
    setEditingTxId(null);
    await reloadTransactions();
  }

  async function cancelTx(txId: number) {
    const res = await fetch('/api/four/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: txId, reason: 'Annulation depuis module FOUR direct' })
    });
    if (!res.ok) return setError((await res.json()).message ?? 'Annulation impossible.');
    await reloadTransactions();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="glass-card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <button type="button" className={`filter-pill ${draftKind === 'buy' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('buy')}>Achat</button>
            <button type="button" className={`filter-pill ${draftKind === 'sell' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('sell')}>Vente</button>
            <input className="saas-input ml-auto w-full max-w-56" placeholder="Recherche item" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto">
            {availableItems.map((item) => (
              <button type="button" key={item.id} className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#3b2418]/55 p-2 text-left" onClick={() => upsertLine(item)}>
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                  {item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#ffe8ca]">{item.name}</p>
                  <p className="text-[11px] text-[#efcdab]">Stock: {item.quantity}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="glass-card space-y-3 p-5">
          <h4 className="text-base font-semibold text-[#fff1dd]">{editingTxId ? `Modifier transaction #${editingTxId}` : 'Nouvelle transaction FOUR'}</h4>
          <input className="saas-input w-full" placeholder="Interlocuteur / Client / Groupe" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          <div className="space-y-2">
            {draftLines.map((line, idx) => (
              <div key={`${line.item_id}-${idx}`} className="rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                    {line.item_image_url ? <Image src={line.item_image_url} alt={line.item_name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#efcdab]">📦</div>}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#ffe8ca]">{line.item_name}</p>
                </div>
                <CompactLineGrid type="four">
                  <CompactField label="Type">
                    <select className="saas-input !h-9 !min-h-9 w-full text-sm" value={line.movement_kind} onChange={(e) => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, movement_kind: e.target.value as LineKind } : entry))}>
                      <option value="buy">Achat</option>
                      <option value="sell">Vente</option>
                    </select>
                  </CompactField>

                  <CompactField label="Quantité">
                    <QuantityStepper
                      value={line.quantity}
                      onDecrease={() => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry))}
                      onIncrease={() => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, quantity: entry.quantity + 1 } : entry))}
                      onChange={(next) => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, quantity: Math.max(1, next || 1) } : entry))}
                    />
                  </CompactField>

                  <CompactField label="Prix">
                    <input className="saas-input !h-9 !min-h-9 w-full text-sm" value={line.unit_price} onChange={(e) => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, unit_price: Math.max(0, Number(e.target.value || 0)) } : entry))} />
                  </CompactField>

                  <CompactActionField>
                    <RemoveLineButton onClick={() => setDraftLines((cur) => cur.filter((_, i) => i !== idx))} />
                  </CompactActionField>
                </CompactLineGrid>
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-orange-300/20 bg-orange-500/10 px-3 py-2.5">
              <p className="text-xs text-[#efcdab]">🛒 Achats transaction</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.purchases)}</p>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-xs text-[#efcdab]">💸 Ventes transaction</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.sales)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${draftTotals.profit >= 0 ? 'border-sky-300/20 bg-sky-500/10' : 'border-rose-300/20 bg-rose-500/10'}`}>
              <p className="text-xs text-[#efcdab]">📈 Résultat transaction</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.profit)}</p>
            </div>
          </div>
          {canCreate ? <button className="saas-primary-btn w-full" onClick={() => void submit()}>{editingTxId ? 'Enregistrer modification' : 'Valider transaction'}</button> : null}
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </article>
      </section>

      <section className="glass-card p-5">
        <h4 className="text-base font-semibold text-[#fff1dd]">Historique FOUR</h4>
        <div className="mt-2 space-y-2">
          {transactions.map((tx) => (
            <article key={tx.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                <p className="text-sm font-semibold text-[#ffe8ca]">#{tx.id}</p>
                <p className="text-sm text-[#f3d7b6]">{tx.counterparty || 'Interlocuteur non renseigné'}</p>
                <p className="text-xs text-[#efcdab]">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                <p className="rounded-lg border border-orange-300/15 bg-orange-500/10 px-2 py-1 text-[#f8ddb8]">🛒 Achats: <span className="font-semibold">{formatUsd(Number(tx.total_purchases ?? 0))}</span></p>
                <p className="rounded-lg border border-emerald-300/15 bg-emerald-500/10 px-2 py-1 text-[#daf5d4]">💸 Ventes: <span className="font-semibold">{formatUsd(Number(tx.total_sales ?? 0))}</span></p>
                <p className="rounded-lg border border-sky-300/15 bg-sky-500/10 px-2 py-1 text-[#d9eefe]">📈 Résultat: <span className="font-semibold">{formatUsd(Number(tx.profit_loss ?? 0))}</span></p>
              </div>
              <div className="mt-2 flex gap-2">
                {canManage(tx, 'edit') && (tx.status ?? 'validated') === 'validated' ? <button type="button" className="saas-ghost-btn" onClick={() => {
                  setEditingTxId(tx.id);
                  setCounterparty(tx.counterparty || '');
                  setDraftLines((tx.four_transaction_lines ?? []).map((line) => ({ item_id: line.item_id, item_name: line.item_name, movement_kind: line.movement_kind, quantity: Number(line.quantity), unit_price: Number(line.unit_price) })));
                }}>Modifier</button> : null}
                {canManage(tx, 'cancel') && (tx.status ?? 'validated') === 'validated' ? <button type="button" className="saas-ghost-btn" onClick={() => void cancelTx(tx.id)}>Annuler</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
