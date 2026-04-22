'use client';

import Image from 'next/image';
import { formatUsd } from '@/lib/currency';

type Totals = { purchases: number; sales: number; profit: number; transactions: number };
type ByClient = { key: string; count: number; purchases: number; sales: number; profit: number; ratio: number };
type ByMember = { key: string; count: number; purchases: number; sales: number; profit: number };
type ByItem = { itemId: number; itemName: string; imageUrl: string | null; buyQty: number; sellQty: number; buyAmount: number; sellAmount: number; frequency: number };
type History = {
  id: number;
  createdAt: string;
  counterparty: string | null;
  creatorLabel: string;
  totals: { purchases: number; sales: number; profit: number };
  lines: Array<{ itemId: number; itemName: string; imageUrl: string | null; movementKind: 'buy' | 'sell'; quantity: number; unitPrice: number; totalAmount: number }>;
};

export function FourStatsClient({ totals, byClient, byMember, byItem, history }: { totals: Totals; byClient: ByClient[]; byMember: ByMember[]; byItem: ByItem[]; history: History[] }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Transactions" value={String(totals.transactions)} icon="🧾" />
        <StatCard label="Achats globaux" value={formatUsd(totals.purchases)} icon="🛒" />
        <StatCard label="Ventes globales" value={formatUsd(totals.sales)} icon="💸" />
        <StatCard label="Résultat global" value={formatUsd(totals.profit)} icon="📈" highlight />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Stats client</h3>
          <div className="mt-3 space-y-2">
            {byClient.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune transaction client pour le moment.</p> : null}
            {byClient.map((row) => (
              <div key={row.key} className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3 text-xs text-[#efcdab]">
                <p className="text-sm font-semibold text-[#ffe8ca]">👥 {row.key}</p>
                <p>Transactions: {row.count}</p>
                <p>Achats: {formatUsd(row.purchases)} · Ventes: {formatUsd(row.sales)}</p>
                <p>Résultat: {formatUsd(row.profit)} · Ratio achat/vente: {row.ratio.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Stats membre</h3>
          <div className="mt-3 space-y-2">
            {byMember.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune transaction membre pour le moment.</p> : null}
            {byMember.map((row) => (
              <div key={row.key} className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3 text-xs text-[#efcdab]">
                <p className="text-sm font-semibold text-[#ffe8ca]">🧑 {row.key}</p>
                <p>Transactions: {row.count}</p>
                <p>Achats: {formatUsd(row.purchases)} · Ventes: {formatUsd(row.sales)}</p>
                <p>Résultat généré: {formatUsd(row.profit)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Stats items</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {byItem.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune ligne item disponible.</p> : null}
          {byItem.map((item) => (
            <article key={item.itemId} className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#1f120d]">
                  {item.imageUrl ? <Image src={item.imageUrl} alt={item.itemName} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#efcdab]">📦</div>}
                </div>
                <p className="text-sm font-semibold text-[#ffe8ca]">{item.itemName}</p>
              </div>
              <div className="mt-2 text-xs text-[#efcdab]">
                <p>Fréquence: {item.frequency}</p>
                <p>Qté achat: {item.buyQty} · Montant achat: {formatUsd(item.buyAmount)}</p>
                <p>Qté vente: {item.sellQty} · Montant vente: {formatUsd(item.sellAmount)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Historique détaillé FOUR</h3>
        <div className="mt-3 space-y-3">
          {history.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune transaction FOUR enregistrée.</p> : null}
          {history.map((tx) => (
            <article key={tx.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                <p className="text-sm font-semibold text-[#ffe8ca]">#{tx.id}</p>
                <p className="text-sm text-[#efcdab]">{tx.counterparty || 'Interlocuteur non renseigné'} · {tx.creatorLabel}</p>
                <p className="text-xs text-[#efcdab]">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                <p className="rounded-lg border border-orange-300/20 bg-orange-500/10 px-2 py-1 text-[#f8ddb8]">🛒 Achats: {formatUsd(tx.totals.purchases)}</p>
                <p className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[#daf5d4]">💸 Ventes: {formatUsd(tx.totals.sales)}</p>
                <p className="rounded-lg border border-sky-300/20 bg-sky-500/10 px-2 py-1 text-[#d9eefe]">📈 Résultat: {formatUsd(tx.totals.profit)}</p>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {tx.lines.map((line, idx) => (
                  <div key={`${tx.id}-${idx}`} className="rounded-lg border border-white/10 bg-[#2c1a12]/55 p-2 text-xs text-[#efcdab]">
                    <p className="font-semibold text-[#ffe8ca]">{line.movementKind === 'buy' ? '🛒 Achat' : '💸 Vente'} · {line.itemName}</p>
                    <p>Qté: {line.quantity} · PU: {formatUsd(line.unitPrice)} · Total: {formatUsd(line.totalAmount)}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <article className={`rounded-xl border p-3 ${highlight ? 'border-emerald-300/20 bg-emerald-500/10' : 'border-white/10 bg-[#3f281b]/50'}`}>
      <p className="text-xs text-[#efcdab]">{icon} {label}</p>
      <p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p>
    </article>
  );
}
