'use client';

import Image from 'next/image';
import { FormEvent, useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { humanMoneyMovementLabel } from '@/lib/labels';

type Movement = {
  id: number;
  type: string;
  amount: number;
  label: string;
  created_at: string;
  user_id: string | null;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
};

type QuickSale = {
  id: number;
  total_amount: number;
  cash_before: number;
  cash_after: number;
  sale_lines: Array<{ itemName: string; quantity: number; unitPrice: number; lineTotal: number; stockBefore: number; stockAfter: number; itemImageUrl?: string | null }>;
  created_at: string;
};

type SellableItem = { id: number; name: string; image_url: string | null; quantity: number; sell_price: number; category_label: string | null };

function moneyMovementIcon(type: string) {
  if (type === 'entry') return '💵';
  if (type === 'exit') return '💸';
  if (type === 'adjust') return '🧮';
  if (type === 'sale') return '🛒';
  if (type === 'purchase') return '🧾';
  if (type === 'tablet_passage' || type === 'tablet_morning_deposit') return '📱';
  if (type === 'four_close') return '🔥';
  if (type.startsWith('drugs_')) return '🧪';
  return '💰';
}

export function MoneyPageClient({
  canEdit,
  initialBalance,
  initialMovements,
  quickSales,
  sellableItems,
  canQuickSaleAccess,
  canQuickSaleCreate,
  canQuickSaleDetailsView
}: {
  canEdit: boolean;
  initialBalance: number;
  initialMovements: Movement[];
  quickSales: QuickSale[];
  sellableItems: SellableItem[];
  canQuickSaleAccess: boolean;
  canQuickSaleCreate: boolean;
  canQuickSaleDetailsView: boolean;
}) {
  const [tab, setTab] = useState<'history' | 'quick_sale'>(canQuickSaleAccess ? 'quick_sale' : 'history');
  const [balance, setBalance] = useState(String(initialBalance));
  const [movements] = useState<Movement[]>(initialMovements);
  const [type, setType] = useState('entry');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [lineQty, setLineQty] = useState<Record<number, number>>({});

  const latest = movements[0];
  const formattedBalance = useMemo(() => formatUsd(Number(balance || 0)), [balance]);
  const saleRows = useMemo(
    () => sellableItems.map((item) => ({ ...item, qty: Math.min(Number(lineQty[item.id] ?? 0), Number(item.quantity ?? 0)), lineTotal: Math.min(Number(lineQty[item.id] ?? 0), Number(item.quantity ?? 0)) * Number(item.sell_price ?? 0) })),
    [lineQty, sellableItems]
  );
  const selectedRows = useMemo(() => saleRows.filter((row) => row.qty > 0), [saleRows]);
  const totalQuickSale = useMemo(() => selectedRows.reduce((sum, row) => sum + row.lineTotal, 0), [selectedRows]);

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/money', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: Number(balance), label: 'Ajustement depuis page Argent' })
    });

    if (!response.ok) {
      setError('Mise à jour impossible.');
      return;
    }

    window.location.reload();
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/money/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: Number(amount), label })
    });

    if (!response.ok) {
      setError('Création mouvement impossible.');
      return;
    }

    window.location.reload();
  }

  async function validateQuickSale() {
    const response = await fetch('/api/money/item-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: selectedRows.map((row) => ({ item_id: row.id, quantity: row.qty })) })
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Vente objets impossible.');
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#fff2de]">Argent</h1>
            <p className="mt-2 text-3xl font-bold text-[#ffe5c0]">{formattedBalance}</p>
            {latest ? <p className="mt-2 text-sm text-[#ffe3c3]">Dernière activité: {humanMoneyMovementLabel(latest.type)} · {formatUsd(Number(latest.amount))} · {latest.label}</p> : null}
          </div>
          <div className="flex gap-2">
            <button className={`filter-pill ${tab === 'history' ? 'filter-pill-active' : ''}`} onClick={() => setTab('history')}>Historique</button>
            {canQuickSaleAccess ? <button className={`filter-pill ${tab === 'quick_sale' ? 'filter-pill-active' : ''}`} onClick={() => setTab('quick_sale')}>Vente objets</button> : null}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {tab === 'history' ? (
        <>
          {canEdit ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <form onSubmit={saveBalance} className="glass-card space-y-3 p-5">
                <h2 className="text-lg font-semibold text-[#fff1db]">Modifier le montant</h2>
                <input className="saas-input w-full" value={balance} onChange={(e) => setBalance(e.target.value)} />
                <button className="saas-primary-btn" type="submit">Enregistrer le montant</button>
              </form>

              <form onSubmit={addMovement} className="glass-card space-y-3 p-5">
                <h2 className="text-lg font-semibold text-[#fff1db]">Ajouter un mouvement</h2>
                <select className="saas-input w-full" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="entry">Entrée</option>
                  <option value="exit">Sortie</option>
                  <option value="purchase">Achat</option>
                  <option value="sale">Vente</option>
                  <option value="payment">Paiement</option>
                </select>
                <input className="saas-input w-full" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <input className="saas-input w-full" placeholder="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />
                <button className="saas-primary-btn" type="submit">Ajouter</button>
              </form>
            </section>
          ) : null}

          <section className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff1db]">Historique</h2>
            <div className="mt-3 space-y-2">
              {movements.map((movement) => (
                <div key={movement.id} className="rounded-xl border border-white/10 bg-[#5a3924]/55 px-3 py-2 text-sm text-[#ffe4c6]">
                  {moneyMovementIcon(movement.type)} {Array.isArray(movement.users) ? (movement.users[0]?.name || movement.users[0]?.username) : (movement.users?.name || movement.users?.username) || 'Groupe'} — {humanMoneyMovementLabel(movement.type)} — {movement.label} — {formatUsd(Number(movement.amount))} · {new Date(movement.created_at).toLocaleString('fr-FR')}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {tab === 'quick_sale' && canQuickSaleAccess ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff1db]">Vente rapide objets</h2>
            <div className="mt-3 space-y-2">
              {saleRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-[#5a3924]/45 p-3">
                  <div className="grid items-center gap-2 md:grid-cols-[auto_1fr_auto_auto]">
                    <ItemImage imageUrl={row.image_url} name={row.name} />
                    <div>
                      <p className="text-sm font-semibold text-[#ffe8ca]">{row.name}</p>
                      <p className="text-xs text-[#efcdab]">{row.category_label || 'Sans catégorie'} · Stock {row.quantity} · Prix {formatUsd(row.sell_price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setLineQty((current) => ({ ...current, [row.id]: Math.max(0, (current[row.id] ?? 0) - 1) }))}>-</button>
                      <input className="saas-input w-20 text-center" value={row.qty} onChange={(event) => setLineQty((current) => ({ ...current, [row.id]: Math.max(0, Math.min(row.quantity, Number(event.target.value || 0))) }))} />
                      <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setLineQty((current) => ({ ...current, [row.id]: Math.min(row.quantity, (current[row.id] ?? 0) + 1) }))}>+</button>
                    </div>
                    <p className="text-sm font-semibold text-[#ffe8ca]">{formatUsd(row.lineTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1db]">Récapitulatif vente</h3>
            <p className="mt-2 text-sm text-[#efcdab]">Lignes: {selectedRows.length}</p>
            <p className="text-xl font-semibold text-[#ffe8ca]">Total: {formatUsd(totalQuickSale)}</p>
            {canQuickSaleCreate ? <button className="saas-primary-btn mt-3 w-full" onClick={() => void validateQuickSale()} disabled={selectedRows.length === 0}>Valider la vente objets</button> : <p className="mt-2 text-sm text-[#f2d2ad]">Permission manquante pour valider une vente objets.</p>}

            {canQuickSaleDetailsView ? (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-[#fff1dd]">Historique ventes objets</h4>
                {quickSales.map((sale) => (
                  <article key={sale.id} className="rounded-xl border border-white/10 bg-[#5a3924]/45 p-3 text-xs text-[#efcdab]">
                    <p className="text-[#ffe8ca]">#{sale.id} · {new Date(sale.created_at).toLocaleString('fr-FR')}</p>
                    <p>Total {formatUsd(sale.total_amount)} · Caisse {formatUsd(sale.cash_before)} → {formatUsd(sale.cash_after)}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}
    </div>
  );
}

function ItemImage({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#22140e]">
      {imageUrl ? <Image src={imageUrl} alt={name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#f1d0ab]">📦</div>}
    </div>
  );
}
