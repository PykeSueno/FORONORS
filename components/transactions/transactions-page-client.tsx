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
type Line = { item_id: number; movement_type: 'purchase' | 'sale' | 'stock_in' | 'stock_out'; quantity: number; unit_price: number };

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

      const movement = line.movement_type;
      if (isMoneyItem) {
        if (movement === 'purchase' || movement === 'stock_out') moneyOut += total;
        else moneyIn += total;
        continue;
      }

      if (movement === 'purchase') {
        stockIn += line.quantity;
        moneyOut += total;
      } else if (movement === 'sale') {
        stockOut += line.quantity;
        moneyIn += total;
      } else if (movement === 'stock_in') {
        stockIn += line.quantity;
      } else {
        stockOut += line.quantity;
      }
    }

    return {
      moneyIn,
      moneyOut,
      stockIn,
      stockOut,
      profit: moneyIn - moneyOut
    };
  }, [lines, items]);

  function addItem(item: Item) {
    setLines((current) => [...current, { item_id: item.id, movement_type: 'sale', quantity: 1, unit_price: Number(item.sell_price || 0) }]);
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
        <p className="mt-1 text-sm text-[#f3d2ad]">Centralisez achats, ventes, entrées et sorties dans une seule transaction.</p>
      </section>

      {canCreate ? (
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold text-[#fff1dd]">Ajouter des items</h2>
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
          </div>

          <div className="space-y-4">
            <section className="glass-card p-5">
              <h3 className="text-base font-semibold text-[#fff1dd]">Contexte</h3>
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
              <h3 className="text-base font-semibold text-[#fff1dd]">Résultat</h3>
              <p className="mt-2 text-sm text-[#c5f2b9]">Entrée argent: +{formatUsd(totals.moneyIn)}</p>
              <p className="text-sm text-[#f2b9b9]">Sortie argent: -{formatUsd(totals.moneyOut)}</p>
              <p className="text-sm text-[#c5f2b9]">Entrée stock: +{totals.stockIn}</p>
              <p className="text-sm text-[#f2b9b9]">Sortie stock: -{totals.stockOut}</p>
              <p className={`mt-2 text-sm font-semibold ${totals.profit >= 0 ? 'text-[#c5f2b9]' : 'text-[#f2b9b9]'}`}>Résultat final: {formatUsd(totals.profit)}</p>
              <button className="saas-primary-btn mt-3 w-full" onClick={() => void submit()}>Valider transaction</button>
            </section>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {canCreate ? (
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#fff1dd]">Lignes de transaction</h2>
          <div className="mt-3 space-y-2">
            {lines.map((line, idx) => {
              const item = items.find((entry) => entry.id === line.item_id);
              return (
                <div key={`${line.item_id}-${idx}`} className="rounded-xl border border-white/10 bg-[#4e311f]/60 p-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <p className="text-sm text-[#ffe8c9]">{item?.name}</p>
                    <select className="saas-input" value={line.movement_type} onChange={(e) => setLines((curr) => curr.map((v, i) => i === idx ? { ...v, movement_type: e.target.value as Line['movement_type'] } : v))}>
                      <option value="purchase">Achat</option>
                      <option value="sale">Vente</option>
                      <option value="stock_in">Entrée stock</option>
                      <option value="stock_out">Sortie stock</option>
                    </select>
                    <input className="saas-input" value={line.quantity} onChange={(e) => setLines((curr) => curr.map((v, i) => i === idx ? { ...v, quantity: Math.max(1, Number(e.target.value || 1)) } : v))} />
                    <input className="saas-input" value={line.unit_price} onChange={(e) => setLines((curr) => curr.map((v, i) => i === idx ? { ...v, unit_price: Math.max(0, Number(e.target.value || 0)) } : v))} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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
