'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '@/lib/currency';

type Item = { id: number; name: string; image_url: string | null; quantity: number; sell_price: number; category_label: string | null; category_key?: string | null };
type SaleRow = {
  id: number;
  buyer_name: string;
  buyer_type: 'pawnshop_sud' | 'pawnshop_nord' | 'group';
  status: 'paid' | 'pending_receipt' | 'canceled';
  total_amount: number;
  sale_lines: Array<{ itemId: number; itemName: string; itemImageUrl?: string | null; quantity: number; unitPrice: number; lineTotal: number; stockBefore: number; stockAfter: number }>;
  cash_before: number | null;
  cash_after: number | null;
  created_by: string | null;
  received_by: string | null;
  canceled_by: string | null;
  received_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: { name?: string | null; username?: string | null } | { name?: string | null; username?: string | null }[] | null;
  receiver?: { name?: string | null; username?: string | null } | { name?: string | null; username?: string | null }[] | null;
};

type CartLine = { item_id: number; item_name: string; image_url: string | null; stock: number; quantity: number; unit_price: number; line_total: number };

export function SaleObjectsPageClient({
  items,
  initialSales,
  canCreate,
  canReceive,
  canEditOwn,
  canEditAny,
  canCancelOwn,
  canCancelAny,
  canHistoryView,
  currentUserId
}: {
  items: Item[];
  initialSales: SaleRow[];
  canCreate: boolean;
  canReceive: boolean;
  canEditOwn: boolean;
  canEditAny: boolean;
  canCancelOwn: boolean;
  canCancelAny: boolean;
  canHistoryView: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [buyerType, setBuyerType] = useState<'pawnshop_sud' | 'pawnshop_nord' | 'group'>('group');
  const [customBuyer, setCustomBuyer] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sales, setSales] = useState<SaleRow[]>(initialSales);
  const [detail, setDetail] = useState<SaleRow | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);

  const filteredItems = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.line_total, 0), [cart]);
  const visibleSales = useMemo(() => sales.filter((sale) => sale.status !== 'canceled'), [sales]);

  function upsertLine(item: Item) {
    setCart((current) => {
      const index = current.findIndex((line) => line.item_id === item.id);
      if (index >= 0) return current;
      return [...current, { item_id: item.id, item_name: item.name, image_url: item.image_url, stock: Number(item.quantity ?? 0), quantity: 0, unit_price: Number(item.sell_price ?? 0), line_total: 0 }];
    });
  }

  function patchLine(itemId: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((line) => {
      if (line.item_id !== itemId) return line;
      const next = { ...line, ...patch };
      next.quantity = Math.max(0, Math.min(next.stock, Number(next.quantity ?? 0)));
      next.unit_price = Math.max(0, Number(next.unit_price ?? 0));
      next.line_total = next.quantity * next.unit_price;
      return next;
    }));
  }

  function removeLine(itemId: number) {
    setCart((current) => current.filter((line) => line.item_id !== itemId));
  }

  async function reloadHistory() {
    if (!canHistoryView) return;
    const response = await fetch('/api/sale-objects', { cache: 'no-store' });
    if (response.ok) {
      const data = (await response.json()) as { sales: SaleRow[] };
      setSales(data.sales ?? []);
    }
  }

  async function submitSale() {
    if (!canCreate) return;
    setError('');
    const lines = cart.filter((line) => line.quantity > 0).map((line) => ({ item_id: line.item_id, quantity: line.quantity, unit_price: line.unit_price }));
    if (lines.length === 0) return setError('Ajoute au moins une ligne avec quantité > 0.');
    if (buyerType === 'group' && !customBuyer.trim()) return setError('Nom du groupe acheteur requis.');

    const endpoint = editingSaleId ? `/api/sale-objects/${editingSaleId}` : '/api/sale-objects';
    const method = editingSaleId ? 'PATCH' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, buyer_type: buyerType, buyer_name: buyerType === 'group' ? customBuyer : undefined })
    });
    if (!response.ok) return setError((await response.json()).message ?? 'Validation impossible.');

    setCart([]);
    setCustomBuyer('');
    setBuyerType('group');
    setEditingSaleId(null);
    await reloadHistory();
    router.refresh();
  }

  async function markReceived(saleId: number) {
    const response = await fetch(`/api/sale-objects/${saleId}/receive`, { method: 'POST' });
    if (!response.ok) return setError((await response.json()).message ?? 'Réception impossible.');
    await reloadHistory();
  }

  async function cancelSale(saleId: number) {
    const response = await fetch(`/api/sale-objects/${saleId}/cancel`, { method: 'POST' });
    if (!response.ok) return setError((await response.json()).message ?? 'Annulation impossible.');
    await reloadHistory();
  }

  function canManageOwn(sale: SaleRow) {
    return sale.created_by === currentUserId;
  }

  function startEdit(sale: SaleRow) {
    if (sale.status === 'canceled') return;
    const editableLines = (sale.sale_lines ?? []).map((line) => ({
      item_id: line.itemId,
      item_name: line.itemName,
      image_url: line.itemImageUrl ?? null,
      stock: Math.max(Number(line.stockAfter ?? 0) + Number(line.quantity ?? 0), Number(line.quantity ?? 0)),
      quantity: Number(line.quantity ?? 0),
      unit_price: Number(line.unitPrice ?? 0),
      line_total: Number(line.lineTotal ?? 0)
    }));
    setEditingSaleId(sale.id);
    setCart(editableLines);
    setBuyerType(sale.buyer_type);
    setCustomBuyer(sale.buyer_type === 'group' ? sale.buyer_name : '');
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="glass-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-[#fff1dd]">Objets vendables</h3>
          <input className="saas-input w-full max-w-60" placeholder="Recherche objet" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="mt-3 max-h-[640px] space-y-2 overflow-y-auto">
          {filteredItems.map((item) => (
            <button key={item.id} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#3b2418]/55 px-3 py-2 text-left" onClick={() => upsertLine(item)}>
              <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#2b1a12]">
                {item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#f2d2ad]">📦</div>}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#ffe8ca]">{item.name}</p>
                <p className="text-xs text-[#efcdab]">Stock {item.quantity} · Prix {formatUsd(Number(item.sell_price ?? 0))}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <article className="glass-card p-5 space-y-3">
          <h3 className="text-lg font-semibold text-[#fff1dd]">{editingSaleId ? `Modifier vente #${editingSaleId}` : 'Récap vente en cours'}</h3>

          <div className="grid gap-2">
            <label className="text-xs text-[#efcdab]">Acheteur</label>
            <select className="saas-input" value={buyerType} onChange={(e) => setBuyerType(e.target.value as 'pawnshop_sud' | 'pawnshop_nord' | 'group')}>
              <option value="group">Groupe (texte libre)</option>
              <option value="pawnshop_sud">Pawnshop Sud</option>
              <option value="pawnshop_nord">Pawnshop Nord</option>
            </select>
            {buyerType === 'group' ? <input className="saas-input" placeholder="Nom du groupe" value={customBuyer} onChange={(e) => setCustomBuyer(e.target.value)} /> : null}
            <p className="text-xs text-[#efcdab]">Statut paiement: {buyerType === 'group' ? 'Payé immédiatement' : 'En attente de réception'}</p>
          </div>

          <div className="space-y-2">
            {cart.map((line) => (
              <div key={line.item_id} className="rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#ffe8ca]">{line.item_name}</p>
                  <button className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => removeLine(line.item_id)}>Suppr</button>
                </div>
                <p className="text-xs text-[#efcdab]">Stock: {line.stock}</p>
                <div className="mt-2 flex items-center gap-1">
                  <button className="saas-ghost-btn !px-2 !py-1" onClick={() => patchLine(line.item_id, { quantity: line.quantity - 1 })}>-</button>
                  <input className="saas-input w-20 text-center" value={line.quantity} onChange={(e) => patchLine(line.item_id, { quantity: Number(e.target.value || 0) })} />
                  <button className="saas-ghost-btn !px-2 !py-1" onClick={() => patchLine(line.item_id, { quantity: line.quantity + 1 })}>+</button>
                  <button className="saas-primary-btn !px-2 !py-1 text-xs" onClick={() => patchLine(line.item_id, { quantity: line.stock })}>MAX</button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input className="saas-input w-28 text-center" value={line.unit_price} onChange={(e) => patchLine(line.item_id, { unit_price: Number(e.target.value || 0) })} />
                  <p className="text-sm font-semibold text-[#ffe8ca]">{formatUsd(line.line_total)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#2f1d14]/45 px-3 py-2">
            <p className="text-xs text-[#efcdab]">Bulle récapitulatif</p>
            <p className="text-xl font-semibold text-[#ffe8ca]">Total: {formatUsd(total)}</p>
          </div>
          {canCreate ? <button className="saas-primary-btn w-full" onClick={() => void submitSale()}>{editingSaleId ? 'Enregistrer la modification' : 'Valider la vente'}</button> : <p className="text-sm text-[#f2d2ad]">Permission manquante pour créer une vente.</p>}
          {editingSaleId ? <button className="saas-ghost-btn w-full" onClick={() => { setEditingSaleId(null); setCart([]); setBuyerType('group'); setCustomBuyer(''); }}>Annuler édition</button> : null}
        </article>

        {canHistoryView ? (
          <article className="glass-card p-5">
            <h4 className="text-base font-semibold text-[#fff1dd]">Historique récent</h4>
            <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
              {visibleSales.map((sale) => {
                const canEdit = canEditAny || (canEditOwn && canManageOwn(sale));
                const canCancel = canCancelAny || (canCancelOwn && canManageOwn(sale));
                return (
                  <div key={sale.id} className="rounded-xl border border-white/10 bg-[#3b2418]/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#ffe8ca]">#{sale.id} · {sale.buyer_name}</p>
                      <span className={`rounded-full px-2 py-1 text-xs ${sale.status === 'paid' ? 'bg-emerald-500/20 text-emerald-200' : sale.status === 'pending_receipt' ? 'bg-amber-500/20 text-amber-100' : 'bg-rose-500/20 text-rose-200'}`}>{sale.status === 'paid' ? 'Payé' : sale.status === 'pending_receipt' ? 'En attente' : 'Annulé'}</span>
                    </div>
                    <p className="text-xs text-[#efcdab]">{new Date(sale.created_at).toLocaleString('fr-FR')} · Total {formatUsd(Number(sale.total_amount ?? 0))}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => setDetail(sale)}>Voir détail</button>
                      {sale.status === 'pending_receipt' && canReceive ? <button className="saas-primary-btn !px-2 !py-1 text-xs" onClick={() => void markReceived(sale.id)}>Reçu</button> : null}
                      {canEdit && sale.status !== 'canceled' ? <button className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => startEdit(sale)}>Modifier</button> : null}
                      {canCancel && sale.status !== 'canceled' ? <button className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => void cancelSale(sale.id)}>Annuler</button> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}
      </section>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[#fff1dd]">Détail vente #{detail.id}</h3>
              <button className="saas-ghost-btn" onClick={() => setDetail(null)}>Fermer</button>
            </div>
            <p className="mt-2 text-xs text-[#efcdab]">Acheteur: {detail.buyer_name} · Statut: {detail.status}</p>
            <p className="text-xs text-[#efcdab]">Argent groupe: {detail.cash_before != null ? formatUsd(Number(detail.cash_before)) : '-'} → {detail.cash_after != null ? formatUsd(Number(detail.cash_after)) : '-'}</p>
            <div className="mt-3 space-y-2">
              {(detail.sale_lines ?? []).map((line, idx) => (
                <article key={`${detail.id}-${idx}`} className="rounded-xl border border-white/10 bg-[#2b1a12]/50 p-3 text-xs text-[#efcdab]">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                      {line.itemImageUrl ? <Image src={line.itemImageUrl} alt={line.itemName} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : null}
                    </div>
                    <p className="text-[#ffe9cd]">{line.itemName}</p>
                  </div>
                  <p>Qté {line.quantity} · PU {formatUsd(Number(line.unitPrice))} · Total {formatUsd(Number(line.lineTotal))}</p>
                  <p>Stock {line.stockBefore} → {line.stockAfter}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {error ? <p className="fixed bottom-4 right-4 z-[100] rounded-xl border border-red-300/45 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}
