'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';

type Item = {
  id: number;
  name: string;
  image_url: string | null;
  buy_price: number;
  sell_price: number;
  quantity: number;
  is_money_item: boolean;
};

type Member = { id: string; name: string; username: string };
type MovementType = 'purchase' | 'sale' | 'stock_in' | 'stock_out';
type Line = { item_id: number; movement_type: MovementType; quantity: number; unit_price: number };

const MOVEMENT_META: Record<MovementType, { label: string; icon: string; tone: string }> = {
  purchase: { label: 'Achat', icon: '🛒', tone: 'text-[#f3b0b0]' },
  sale: { label: 'Vente', icon: '💸', tone: 'text-[#c2f2b8]' },
  stock_in: { label: 'Entrée', icon: '📥', tone: 'text-[#c2f2b8]' },
  stock_out: { label: 'Sortie', icon: '📤', tone: 'text-[#f3b0b0]' }
};

export function TransactionsPageClient({
  canCreate,
  items,
  members,
  transactions,
  defaultMemberLabel,
  defaultMemberId
}: {
  canCreate: boolean;
  items: Item[];
  members: Member[];
  transactions: Array<{ id: number; reason: string; member_label: string; total_money_in: number; total_money_out: number; profit_loss: number; created_at: string; transaction_lines: Array<{ item_name_snapshot: string; quantity: number; movement_type: string }> }>;
  defaultMemberLabel: string;
  defaultMemberId: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState('');
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [error, setError] = useState('');

  const totals = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    let stockIn = 0;
    let stockOut = 0;

    for (const line of lines) {
      const total = line.quantity * line.unit_price;
      const item = items.find((entry) => entry.id === line.item_id);
      const isMoneyItem = Boolean(item?.is_money_item);

      if (isMoneyItem) {
        if (line.movement_type === 'purchase' || line.movement_type === 'stock_out') moneyOut += total;
        else moneyIn += total;
        continue;
      }

      if (line.movement_type === 'purchase') {
        stockIn += line.quantity;
        moneyOut += total;
      } else if (line.movement_type === 'sale') {
        stockOut += line.quantity;
        moneyIn += total;
      } else if (line.movement_type === 'stock_in') {
        stockIn += line.quantity;
      } else {
        stockOut += line.quantity;
      }
    }

    return { moneyIn, moneyOut, stockIn, stockOut, profit: moneyIn - moneyOut };
  }, [lines, items]);

  function addItem(item: Item) {
    setLines((current) => [...current, { item_id: item.id, movement_type: 'sale', quantity: 1, unit_price: Number(item.sell_price || 0) }]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  async function submit() {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, member_user_id: memberId || null, member_label: memberLabel || 'Groupe', lines })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Transaction impossible.');
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <h1 className="text-2xl font-semibold text-[#fff1dc]">Transactions</h1>
        <p className="mt-1 text-sm text-[#f3d2ad]">Ajoutez vos items à gauche, pilotez toute la transaction à droite.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#fff1dd]">Ajouter des items</h2>
          <p className="mt-1 text-xs text-[#f0d0ac]">Cliquez un item pour l’ajouter immédiatement à la transaction.</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <button key={item.id} className="rounded-xl border border-white/15 bg-[#3f281b]/60 p-3 text-left smooth-hover" onClick={() => addItem(item)}>
                <div className="mb-2 h-20 rounded-lg bg-[#22140e]">
                  {item.image_url ? <Image src={item.image_url} alt={item.name} width={280} height={120} className="h-full w-full rounded-lg object-cover" unoptimized /> : null}
                </div>
                <p className="font-medium text-[#ffe8c9]">{item.name}</p>
                <p className="text-xs text-[#f3d2ad]">Stock: {item.quantity}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">A. Contexte</h3>
            <label className="mt-3 block text-xs text-[#efccaa]">Membre</label>
            <select className="saas-input mt-1 w-full" value={memberId} onChange={(e) => { setMemberId(e.target.value); const m = members.find((x) => x.id === e.target.value); setMemberLabel(m ? (m.name || m.username) : 'Groupe'); }}>
              <option value="">Groupe</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name || member.username}</option>
              ))}
            </select>

            <label className="mt-3 block text-xs text-[#efccaa]">Motif</label>
            <input className="saas-input mt-1 w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vente event, achat stock..." />
          </section>

          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">B. Lignes de transaction</h3>
            <div className="mt-3 space-y-2">
              {lines.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucune ligne pour le moment.</p> : null}
              {lines.map((line, idx) => {
                const item = items.find((entry) => entry.id === line.item_id);
                if (!item) return null;
                const meta = MOVEMENT_META[line.movement_type];
                const lineTotal = line.quantity * line.unit_price;

                return (
                  <article key={`${line.item_id}-${idx}`} className="rounded-xl border border-white/10 bg-[#4e311f]/60 p-3">
                    <div className="grid gap-3 xl:grid-cols-[auto_1fr_auto_auto_auto_auto] xl:items-center">
                      <div className="h-14 w-14 overflow-hidden rounded-lg bg-[#23140e]">
                        {item.image_url ? <Image src={item.image_url} alt={item.name} width={80} height={80} className="h-full w-full object-cover" unoptimized /> : null}
                      </div>

                      <div>
                        <p className="font-medium text-[#ffe8c9]">{item.name}</p>
                        <p className={`text-xs ${meta.tone}`}>{meta.icon} {meta.label}</p>
                      </div>

                      <select className="saas-input" value={line.movement_type} onChange={(e) => updateLine(idx, { movement_type: e.target.value as MovementType })}>
                        <option value="stock_in">Entrée</option>
                        <option value="stock_out">Sortie</option>
                        <option value="purchase">Achat</option>
                        <option value="sale">Vente</option>
                      </select>

                      <div className="flex items-center gap-1">
                        <button type="button" className="saas-ghost-btn !px-2" onClick={() => updateLine(idx, { quantity: Math.max(1, line.quantity - 1) })}>-</button>
                        <input className="saas-input w-16 text-center" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                        <button type="button" className="saas-ghost-btn !px-2" onClick={() => updateLine(idx, { quantity: line.quantity + 1 })}>+</button>
                      </div>

                      <input className="saas-input w-24" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: Math.max(0, Number(e.target.value || 0)) })} />

                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#ffe8c9]">{formatUsd(lineTotal)}</p>
                        <button type="button" className="saas-ghost-btn !px-2" onClick={() => removeLine(idx)}>🗑️</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">C. Résultat</h3>
            <p className="mt-2 text-sm text-[#c5f2b9]">Entrée argent: +{formatUsd(totals.moneyIn)}</p>
            <p className="text-sm text-[#f2b9b9]">Sortie argent: -{formatUsd(totals.moneyOut)}</p>
            <p className="text-sm text-[#c5f2b9]">Entrée stock: +{totals.stockIn}</p>
            <p className="text-sm text-[#f2b9b9]">Sortie stock: -{totals.stockOut}</p>
            <p className={`mt-2 text-sm font-semibold ${totals.profit >= 0 ? 'text-[#c5f2b9]' : 'text-[#f2b9b9]'}`}>Résultat final: {formatUsd(totals.profit)}</p>
            {canCreate ? <button className="saas-primary-btn mt-3 w-full" onClick={() => void submit()}>Valider transaction</button> : null}
          </section>
        </section>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1dd]">Transactions récentes</h2>
        <div className="mt-3 space-y-2">
          {transactions.map((transaction) => (
            <article key={transaction.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f4d4b0]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">#{transaction.id} · {transaction.reason}</p>
                <p>{new Date(transaction.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <p className="mt-1">Membre: {transaction.member_label}</p>
              <p className="mt-1">Items: {transaction.transaction_lines.map((line) => `${line.item_name_snapshot} x${line.quantity}`).join(', ')}</p>
              <p className="mt-1">Entrée {formatUsd(Number(transaction.total_money_in))} · Sortie {formatUsd(Number(transaction.total_money_out))} · Résultat {formatUsd(Number(transaction.profit_loss))}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
