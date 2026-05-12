'use client';

import { formatUsd } from '@/lib/currency';

type History = {
  id: number;
  createdAt: string;
  counterparty: string | null;
  creatorLabel: string;
  totals: { purchases: number; sales: number; profit: number };
  lines: Array<{ itemName: string; movementKind: 'buy' | 'sell'; quantity: number; unitPrice: number; totalAmount: number }>;
};

export function FourHistoryClient({ history }: { history: History[] }) {
  return (
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
              <p className="rounded-lg border border-orange-300/20 bg-orange-500/10 px-2 py-1 text-[#f8ddb8]">Achats: {formatUsd(tx.totals.purchases)}</p>
              <p className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[#daf5d4]">Ventes: {formatUsd(tx.totals.sales)}</p>
              <p className="rounded-lg border border-sky-300/20 bg-sky-500/10 px-2 py-1 text-[#d9eefe]">Résultat: {formatUsd(tx.totals.profit)}</p>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {tx.lines.map((line, idx) => (
                <div key={`${tx.id}-${idx}`} className="rounded-lg border border-white/10 bg-[#2c1a12]/55 p-2 text-xs text-[#efcdab]">
                  <p className="font-semibold text-[#ffe8ca]">{line.movementKind === 'buy' ? 'Achat' : 'Vente'} · {line.itemName}</p>
                  <p>Qté: {line.quantity} · PU: {formatUsd(line.unitPrice)} · Total: {formatUsd(line.totalAmount)}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
