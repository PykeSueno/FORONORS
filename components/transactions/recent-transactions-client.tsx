'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { humanStockMovementLabel } from '@/lib/labels';

type RecentTransaction = {
  id: number;
  reason: string;
  member_label: string;
  total_money_in: number;
  total_money_out: number;
  profit_loss: number;
  created_at: string;
  transaction_lines: Array<{
    item_name_snapshot: string;
    quantity: number;
    movement_type: string;
    items: { image_url: string | null } | Array<{ image_url: string | null }> | null;
  }>;
};

export function RecentTransactionsClient({ transactions }: { transactions: RecentTransaction[] }) {
  const [query, setQuery] = useState('');
  const [member, setMember] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [movementType, setMovementType] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [flow, setFlow] = useState('');

  const members = useMemo(() => Array.from(new Set(transactions.map((entry) => entry.member_label))).sort(), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((transaction) => {
      const textMatch = !query || `${transaction.reason} ${transaction.member_label} ${transaction.id}`.toLowerCase().includes(query.toLowerCase());
      const memberMatch = !member || transaction.member_label === member;
      const dateValue = new Date(transaction.created_at);
      const fromMatch = !fromDate || dateValue >= new Date(`${fromDate}T00:00:00`);
      const toMatch = !toDate || dateValue <= new Date(`${toDate}T23:59:59`);
      const movementMatch = !movementType || transaction.transaction_lines.some((line) => line.movement_type === movementType);
      const itemMatch = !itemQuery || transaction.transaction_lines.some((line) => line.item_name_snapshot.toLowerCase().includes(itemQuery.toLowerCase()));

      const flowMatch = !flow
        || (flow === 'entry' && Number(transaction.total_money_in) > 0)
        || (flow === 'exit' && Number(transaction.total_money_out) > 0)
        || (flow === 'balanced' && Number(transaction.total_money_in) === 0 && Number(transaction.total_money_out) === 0);

      return textMatch && memberMatch && fromMatch && toMatch && movementMatch && itemMatch && flowMatch;
    });
  }, [transactions, query, member, fromDate, toDate, movementType, itemQuery, flow]);

  return (
    <div className="space-y-4">
      <section className="glass-card p-4">
        <h3 className="text-base font-semibold text-[#fff1dd]">Filtres</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input className="saas-input" placeholder="Recherche texte" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="saas-input" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">Tous les membres</option>
            {members.map((memberLabel) => <option key={memberLabel} value={memberLabel}>{memberLabel}</option>)}
          </select>
          <input type="date" className="saas-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="saas-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <select className="saas-input" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
            <option value="">Tous les types de mouvement</option>
            <option value="sale">Vente</option>
            <option value="purchase">Achat</option>
            <option value="stock_in">Entrée stock</option>
            <option value="stock_out">Sortie stock</option>
          </select>
          <input className="saas-input" placeholder="Item concerné" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
          <select className="saas-input" value={flow} onChange={(e) => setFlow(e.target.value)}>
            <option value="">Tous les flux argent</option>
            <option value="entry">Entrée</option>
            <option value="exit">Sortie</option>
            <option value="balanced">Sans mouvement argent</option>
          </select>
          <button
            className="saas-ghost-btn"
            onClick={() => {
              setQuery('');
              setMember('');
              setFromDate('');
              setToDate('');
              setMovementType('');
              setItemQuery('');
              setFlow('');
            }}
          >
            Réinitialiser
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {filtered.map((transaction) => (
          <article key={transaction.id} className="glass-card border-l-4 border-l-[#f1c792] p-4 text-sm text-[#f4d4b0]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold">🔄 #{transaction.id} · {transaction.reason}</p>
              <p className="text-xs">{new Date(transaction.created_at).toLocaleString('fr-FR')}</p>
            </div>
            <p className="mt-1 text-xs text-[#f6d8b7]">👤 {transaction.member_label}</p>

            <div className="mt-3 grid gap-2">
              {transaction.transaction_lines.map((line, index) => {
                const imageUrl = Array.isArray(line.items) ? line.items[0]?.image_url : line.items?.image_url;
                return (
                  <div key={index} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#3d2619]/60 px-3 py-2">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#23140e]">
                      {imageUrl ? <Image src={imageUrl} alt={line.item_name_snapshot} width={48} height={48} className="h-full w-full object-cover" unoptimized /> : null}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#ffe8ca]">{line.item_name_snapshot} x{line.quantity}</p>
                      <p className="text-xs text-[#efd0aa]">{humanStockMovementLabel(line.movement_type)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <p className="rounded-xl bg-[#83d89f]/10 px-3 py-2 text-[#cbf5d6]">Entrée: {formatUsd(Number(transaction.total_money_in))}</p>
              <p className="rounded-xl bg-[#e08f8f]/10 px-3 py-2 text-[#f8caca]">Sortie: {formatUsd(Number(transaction.total_money_out))}</p>
              <p className={`rounded-xl px-3 py-2 ${Number(transaction.profit_loss) >= 0 ? 'bg-[#83d89f]/10 text-[#cbf5d6]' : 'bg-[#e08f8f]/10 text-[#f8caca]'}`}>Résultat: {formatUsd(Number(transaction.profit_loss))}</p>
            </div>
          </article>
        ))}

        {filtered.length === 0 ? <p className="glass-card p-4 text-sm text-[#f3d4b0]">Aucune transaction ne correspond aux filtres.</p> : null}
      </section>
    </div>
  );
}
