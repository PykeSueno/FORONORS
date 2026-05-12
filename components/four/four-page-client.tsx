'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { CompactActionField, CompactField, CompactLineGrid, QuantityStepper, RemoveLineButton } from '@/components/shared/line-controls';

type Item = { id: number; name: string; image_url: string | null; quantity: number; buy_price?: number; sell_price?: number; category_key?: string | null; type_key?: string | null };
type LineKind = 'buy' | 'sell';
type PaymentMode = 'cash' | 'bank';
type FourLine = { item_id: number; item_name: string; item_image_url?: string | null; movement_kind: LineKind; quantity: number; unit_price: number };
type FourCategory = 'objects' | 'equipment' | 'drugs';
type FourTx = {
  id: number;
  counterparty: string | null;
  status?: 'validated' | 'pending_bank' | 'canceled';
  cancel_reason?: string | null;
  created_by?: string | null;
  total_purchases: number;
  total_sales: number;
  profit_loss: number;
  cash_before?: number | null;
  cash_after?: number | null;
  cash_delta?: number | null;
  created_at: string;
  four_transaction_lines: Array<{ id: number; item_id: number; item_name: string; movement_kind: LineKind; quantity: number; unit_price: number; total_amount: number }>;
};

function isAllowedFourItem(item: Item) {
  return getFourItemCategory(item) !== null;
}

function getFourItemCategory(item: Item): FourCategory | null {
  const name = item.name.toLowerCase();
  const category = (item.category_key ?? '').toLowerCase();
  const type = (item.type_key ?? '').toLowerCase();
  if (category === 'drugs') {
    const isBag = type === 'bag' || name.includes('pochon');
    const isRaw = name.includes('graine') || name.includes('table');
    return isBag && !isRaw ? 'drugs' : null;
  }
  if (category === 'objects') return 'objects';
  if (category === 'equipment' || name.includes('kit') || name.includes('disqueuse')) return 'equipment';
  return null;
}

function getDefaultLineKind(item: Item, fallback: LineKind): LineKind {
  const category = getFourItemCategory(item);
  if (category === 'objects') return 'buy';
  if (category === 'equipment') return 'sell';
  return fallback;
}

function getLineTotal(line: Pick<FourLine, 'quantity' | 'unit_price'>) {
  return Number(line.quantity ?? 0) * Number(line.unit_price ?? 0);
}

function getPaymentMode(tx: FourTx): PaymentMode {
  return tx.status === 'pending_bank' ? 'bank' : 'cash';
}

function isEditableTx(tx: FourTx) {
  return (tx.status ?? 'validated') === 'validated' || tx.status === 'pending_bank';
}

function getTxCashDelta(tx: FourTx) {
  if (typeof tx.cash_delta === 'number') return tx.cash_delta;
  return getPaymentMode(tx) === 'bank' ? -Number(tx.total_purchases ?? 0) : Number(tx.profit_loss ?? 0);
}

function describeLine(line: FourTx['four_transaction_lines'][number]) {
  const total = Number(line.total_amount ?? Number(line.quantity ?? 0) * Number(line.unit_price ?? 0));
  return `${line.quantity} x ${line.item_name} à ${formatUsd(Number(line.unit_price ?? 0))} = ${formatUsd(total)}`;
}

export function FourPageClient({ items, initialTransactions, initialCashBalance, canCreate, canEditOwn, canEditAny, canCancelOwn, canCancelAny, currentUserId }: {
  items: Item[];
  initialTransactions: FourTx[];
  initialCashBalance: number;
  canCreate: boolean;
  canEditOwn: boolean;
  canEditAny: boolean;
  canCancelOwn: boolean;
  canCancelAny: boolean;
  currentUserId: string;
}) {
  const [currentItems, setCurrentItems] = useState(items);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [cashBalance, setCashBalance] = useState(initialCashBalance);
  const [query, setQuery] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [draftKind, setDraftKind] = useState<LineKind>('buy');
  const [itemCategory, setItemCategory] = useState<FourCategory>('objects');
  const [draftLines, setDraftLines] = useState<FourLine[]>([]);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const availableItems = useMemo(
    () => currentItems
      .filter((item) => isAllowedFourItem(item) && getFourItemCategory(item) === itemCategory)
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [currentItems, itemCategory, query]
  );
  const itemById = useMemo(() => new Map(currentItems.map((item) => [item.id, item])), [currentItems]);
  const draftTotals = useMemo(() => {
    const purchases = draftLines.filter((line) => line.movement_kind === 'buy').reduce((sum, line) => sum + getLineTotal(line), 0);
    const sales = draftLines.filter((line) => line.movement_kind === 'sell').reduce((sum, line) => sum + getLineTotal(line), 0);
    const profit = sales - purchases;
    return { purchases, sales, profit, cashImpact: paymentMode === 'bank' ? -purchases : profit };
  }, [draftLines, paymentMode]);

  function upsertLine(item: Item) {
    setError('');
    const movementKind = getDefaultLineKind(item, draftKind);
    setDraftLines((current) => {
      const idx = current.findIndex((line) => line.item_id === item.id && line.movement_kind === movementKind);
      const unitPrice = movementKind === 'buy' ? Number(item.buy_price ?? 0) : Number(item.sell_price ?? 0);
      if (movementKind === 'sell') {
        const currentQty = idx >= 0 ? current[idx].quantity : 0;
        if (currentQty >= Number(item.quantity ?? 0)) {
          setError(`Stock insuffisant pour ${item.name}.`);
          return current;
        }
      }
      if (idx >= 0) return current.map((line, i) => i === idx ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { item_id: item.id, item_name: item.name, item_image_url: item.image_url, movement_kind: movementKind, quantity: 1, unit_price: unitPrice }];
    });
  }

  function canManage(tx: FourTx, mode: 'edit' | 'cancel') {
    if (mode === 'edit') return canEditAny || (canEditOwn && tx.created_by === currentUserId);
    return canCancelAny || (canCancelOwn && tx.created_by === currentUserId);
  }

  function applyMutationPayload(payload: { transaction?: FourTx | null; itemUpdates?: Array<{ id: number; quantity: number }>; cash?: { after: number } }) {
    if (payload.itemUpdates?.length) {
      setCurrentItems((current) => current.map((item) => {
        const update = payload.itemUpdates?.find((entry) => entry.id === item.id);
        return update ? { ...item, quantity: update.quantity } : item;
      }));
    }
    if (payload.transaction) {
      setTransactions((current) => {
        const without = current.filter((tx) => tx.id !== payload.transaction?.id);
        return [payload.transaction as FourTx, ...without].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    }
    if (payload.cash) setCashBalance(Number(payload.cash.after ?? 0));
  }

  async function submit() {
    setError('');
    if (draftLines.length === 0) return setError('Ajoute au moins une ligne.');
    const payload = {
      counterparty,
      payment_mode: paymentMode,
      lines: draftLines.map((line) => ({ item_id: line.item_id, movement_kind: line.movement_kind, quantity: line.quantity, unit_price: line.unit_price }))
    };
    const res = await fetch('/api/four/transactions', {
      method: editingTxId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingTxId ? { transaction_id: editingTxId, ...payload } : payload)
    });
    if (!res.ok) return setError((await res.json()).message ?? 'Validation impossible.');
    applyMutationPayload(await res.json());
    setDraftLines([]);
    setCounterparty('');
    setPaymentMode('cash');
    setEditingTxId(null);
  }

  async function cancelTx(txId: number) {
    const res = await fetch('/api/four/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: txId, reason: 'Annulation depuis module FOUR direct' })
    });
    if (!res.ok) return setError((await res.json()).message ?? 'Annulation impossible.');
    applyMutationPayload(await res.json());
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2.5">
          <p className="text-xs text-[#efcdab]">Caisse groupe</p>
          <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(cashBalance)}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="glass-card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`filter-pill ${draftKind === 'buy' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('buy')}>Achat</button>
            <button type="button" className={`filter-pill ${draftKind === 'sell' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('sell')}>Vente</button>
            <input className="saas-input ml-auto w-full max-w-56" placeholder="Recherche item" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={`filter-pill ${itemCategory === 'objects' ? 'filter-pill-active' : ''}`} onClick={() => setItemCategory('objects')}>Objets</button>
            <button type="button" className={`filter-pill ${itemCategory === 'equipment' ? 'filter-pill-active' : ''}`} onClick={() => setItemCategory('equipment')}>Équipement</button>
            <button type="button" className={`filter-pill ${itemCategory === 'drugs' ? 'filter-pill-active' : ''}`} onClick={() => setItemCategory('drugs')}>Drogue</button>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto">
            {availableItems.map((item) => {
              const defaultKind = getDefaultLineKind(item, draftKind);
              return (
                <button type="button" key={item.id} className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#3b2418]/55 p-2 text-left" onClick={() => upsertLine(item)}>
                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                    {item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#ffe8ca]">{item.name}</p>
                    <p className="text-[11px] text-[#efcdab]">Stock: {item.quantity} · {defaultKind === 'buy' ? 'objet rapporté' : 'vente stock'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="glass-card space-y-3 p-5">
          <h4 className="text-base font-semibold text-[#fff1dd]">{editingTxId ? `Modifier transaction #${editingTxId}` : 'Vente partenaire'}</h4>
          <input className="saas-input w-full" placeholder="Partenaire / Interlocuteur" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`filter-pill ${paymentMode === 'cash' ? 'filter-pill-active' : ''}`} onClick={() => setPaymentMode('cash')}>Cash</button>
            <button type="button" className={`filter-pill ${paymentMode === 'bank' ? 'filter-pill-active' : ''}`} onClick={() => setPaymentMode('bank')}>Bank</button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#efcdab]">Objets sélectionnés</p>
            {draftLines.length === 0 ? <p className="rounded-xl border border-white/10 bg-[#2f1d14]/45 px-3 py-2 text-sm text-[#efcdab]">Aucun objet sélectionné.</p> : null}
            {draftLines.map((line, idx) => {
              const itemStock = Number(itemById.get(line.item_id)?.quantity ?? 0);
              const maxSellQty = editingTxId && line.movement_kind === 'sell' ? itemStock + line.quantity : itemStock;
              const lineTotal = getLineTotal(line);
              return (
                <div key={`${line.item_id}-${idx}`} className="rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                      {line.item_image_url ? <Image src={line.item_image_url} alt={line.item_name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#efcdab]">Item</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#ffe8ca]">{line.item_name}</p>
                      <p className="text-[11px] text-[#efcdab]">{line.movement_kind === 'buy' ? 'Objet rapporté / achat' : 'Kit ou disqueuse / vente'}</p>
                    </div>
                    <p className="rounded-lg border border-amber-200/15 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-[#ffe8ca]">{formatUsd(lineTotal)}</p>
                  </div>
                  <CompactLineGrid type="four">
                    <CompactField label="Type">
                      <select className="saas-input !h-9 !min-h-9 w-full text-sm" value={line.movement_kind} onChange={(e) => setDraftLines((cur) => cur.map((entry, i) => {
                        if (i !== idx) return entry;
                        const movementKind = e.target.value as LineKind;
                        const stock = Number(itemById.get(entry.item_id)?.quantity ?? 0);
                        const sourceItem = itemById.get(entry.item_id);
                        const unitPrice = movementKind === 'buy' ? Number(sourceItem?.buy_price ?? entry.unit_price ?? 0) : Number(sourceItem?.sell_price ?? entry.unit_price ?? 0);
                        return { ...entry, movement_kind: movementKind, unit_price: unitPrice, quantity: movementKind === 'sell' ? Math.max(1, Math.min(entry.quantity, stock)) : entry.quantity };
                      }))}>
                        <option value="buy">Achat objet</option>
                        <option value="sell">Vente stock</option>
                      </select>
                    </CompactField>

                    <CompactField label="Quantité">
                      <QuantityStepper
                        value={line.quantity}
                        onDecrease={() => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry))}
                        onIncrease={() => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, quantity: entry.movement_kind === 'sell' ? Math.min(maxSellQty, entry.quantity + 1) : entry.quantity + 1 } : entry))}
                        onChange={(next) => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, quantity: entry.movement_kind === 'sell' ? Math.max(1, Math.min(maxSellQty, next || 1)) : Math.max(1, next || 1) } : entry))}
                      />
                      {line.movement_kind === 'sell' ? <p className="mt-1 text-[10px] text-[#efcdab]">Stock dispo {maxSellQty}</p> : null}
                    </CompactField>

                    <CompactField label={line.movement_kind === 'buy' ? "Prix achat" : "Prix vente"}>
                      <input className="saas-input !h-9 !min-h-9 w-full text-sm" value={line.unit_price} inputMode="numeric" onChange={(e) => setDraftLines((cur) => cur.map((entry, i) => i === idx ? { ...entry, unit_price: Math.max(0, Number(e.target.value || 0)) } : entry))} />
                    </CompactField>

                    <CompactField label="Total ligne">
                      <div className="flex h-9 items-center rounded-lg border border-white/10 bg-[#1f120d]/70 px-2 text-sm font-semibold text-[#ffe8ca]">{formatUsd(lineTotal)}</div>
                    </CompactField>

                    <CompactActionField>
                      <RemoveLineButton onClick={() => setDraftLines((cur) => cur.filter((_, i) => i !== idx))} />
                    </CompactActionField>
                  </CompactLineGrid>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-xs text-[#efcdab]">Total vente kits/disqueuses</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.sales)}</p>
            </div>
            <div className="rounded-xl border border-orange-300/20 bg-orange-500/10 px-3 py-2.5">
              <p className="text-xs text-[#efcdab]">Total achat objets rapportés</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.purchases)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${draftTotals.profit >= 0 ? 'border-sky-300/20 bg-sky-500/10' : 'border-rose-300/20 bg-rose-500/10'}`}>
              <p className="text-xs text-[#efcdab]">Résultat net</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.profit)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${draftTotals.cashImpact >= 0 ? 'border-lime-300/20 bg-lime-500/10' : 'border-red-300/20 bg-red-500/10'}`}>
              <p className="text-xs text-[#efcdab]">Impact caisse {paymentMode === 'bank' ? 'Bank' : 'Cash'}</p>
              <p className="mt-1 text-base font-semibold text-[#ffe8ca]">{formatUsd(draftTotals.cashImpact)}</p>
            </div>
          </div>
          {paymentMode === 'bank' ? <p className="text-xs text-[#efcdab]">Bank: la vente reste en attente, l&apos;achat des objets rapportés est retiré de la caisse.</p> : null}
          {canCreate ? <button className="saas-primary-btn w-full" onClick={() => void submit()}>{editingTxId ? 'Enregistrer modification' : 'Valider vente partenaire'}</button> : null}
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </article>
      </section>

      <section className="glass-card p-5">
        <h4 className="text-base font-semibold text-[#fff1dd]">Historique partenaire</h4>
        <div className="mt-2 space-y-2">
          {transactions.map((tx) => {
            const sellLines = (tx.four_transaction_lines ?? []).filter((line) => line.movement_kind === 'sell');
            const buyLines = (tx.four_transaction_lines ?? []).filter((line) => line.movement_kind === 'buy');
            const mode = getPaymentMode(tx);
            const cashDelta = getTxCashDelta(tx);
            return (
              <article key={tx.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <p className="text-sm font-semibold text-[#ffe8ca]">#{tx.id}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#f3d7b6]">{tx.counterparty || 'Partenaire non renseigné'}</p>
                    <p className="text-xs text-[#efcdab]">{mode === 'bank' ? 'Bank en attente' : tx.status === 'canceled' ? 'Annulée' : 'Cash'} · {new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <p className={`rounded-lg border px-2 py-1 text-xs font-semibold ${cashDelta >= 0 ? 'border-emerald-300/20 bg-emerald-500/10 text-[#daf5d4]' : 'border-red-300/20 bg-red-500/10 text-[#ffd0c9]'}`}>Impact caisse {formatUsd(cashDelta)}</p>
                </div>

                <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                  <p className="rounded-lg border border-emerald-300/15 bg-emerald-500/10 px-2 py-1 text-[#daf5d4]">Vente kits/disqueuses: <span className="font-semibold">{formatUsd(Number(tx.total_sales ?? 0))}</span></p>
                  <p className="rounded-lg border border-orange-300/15 bg-orange-500/10 px-2 py-1 text-[#f8ddb8]">Achat objets rapportés: <span className="font-semibold">{formatUsd(Number(tx.total_purchases ?? 0))}</span></p>
                  <p className="rounded-lg border border-sky-300/15 bg-sky-500/10 px-2 py-1 text-[#d9eefe]">Résultat net: <span className="font-semibold">{formatUsd(Number(tx.profit_loss ?? 0))}</span></p>
                </div>

                <div className="mt-2 grid gap-2 text-xs lg:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-[#2f1d14]/55 p-2">
                    <p className="font-semibold text-[#ffe8ca]">Stock sorti</p>
                    {sellLines.length === 0 ? <p className="text-[#efcdab]">Aucune vente stock.</p> : sellLines.map((line) => <p key={`sell-${line.id}`} className="mt-1 text-[#efcdab]">{describeLine(line)} · stock -{line.quantity}</p>)}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#2f1d14]/55 p-2">
                    <p className="font-semibold text-[#ffe8ca]">Objets achetés</p>
                    {buyLines.length === 0 ? <p className="text-[#efcdab]">Aucun objet rapporté.</p> : buyLines.map((line) => <p key={`buy-${line.id}`} className="mt-1 text-[#efcdab]">{describeLine(line)} · stock +{line.quantity}</p>)}
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-white/10 bg-[#2f1d14]/55 px-2 py-1 text-xs text-[#efcdab]">
                  Argent groupe: {typeof tx.cash_before === 'number' ? formatUsd(tx.cash_before) : '-'} → {typeof tx.cash_after === 'number' ? formatUsd(tx.cash_after) : '-'} · mouvement {formatUsd(cashDelta)}
                </div>

                <div className="mt-2 flex gap-2">
                  {canManage(tx, 'edit') && isEditableTx(tx) ? <button type="button" className="saas-ghost-btn" onClick={() => {
                    setEditingTxId(tx.id);
                    setCounterparty(tx.counterparty || '');
                    setPaymentMode(getPaymentMode(tx));
                    setDraftLines((tx.four_transaction_lines ?? []).map((line) => ({ item_id: line.item_id, item_name: line.item_name, item_image_url: itemById.get(line.item_id)?.image_url ?? null, movement_kind: line.movement_kind, quantity: Number(line.quantity), unit_price: Number(line.unit_price) })));
                  }}>Modifier</button> : null}
                  {canManage(tx, 'cancel') && isEditableTx(tx) ? <button type="button" className="saas-ghost-btn" onClick={() => void cancelTx(tx.id)}>Annuler</button> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
