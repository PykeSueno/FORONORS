'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { formatUsd } from '@/lib/currency';
import { humanMoneyMovementLabel, moneyMovementIcon } from '@/lib/labels';

type Row = {
  id: number;
  type: string;
  amount: number;
  label: string;
  before_amount: number | null;
  after_amount: number | null;
  related_item_name: string | null;
  created_at: string;
  user_name: string;
  source: string;
};

export function MoneyMovementsPageClient({ rows, moneyItemImageUrl }: { rows: Row[]; moneyItemImageUrl: string | null }) {
  const [period, setPeriod] = useState('');
  const [member, setMember] = useState('');
  const [source, setSource] = useState('');
  const [direction, setDirection] = useState('');
  const [query, setQuery] = useState('');

  const members = useMemo(() => Array.from(new Set(rows.map((row) => row.user_name))).sort((a, b) => a.localeCompare(b, 'fr')), [rows]);
  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.source))).sort((a, b) => a.localeCompare(b, 'fr')), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (member && row.user_name !== member) return false;
    if (source && row.source !== source) return false;
    if (direction === 'in' && Number(row.amount) <= 0) return false;
    if (direction === 'out' && Number(row.amount) >= 0) return false;
    if (query) {
      const q = query.toLowerCase();
      const blob = `${row.label} ${row.user_name} ${row.source} ${humanMoneyMovementLabel(row.type)}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (period) {
      const days = Number(period);
      const dt = new Date(row.created_at).getTime();
      const min = Date.now() - (days * 24 * 3600 * 1000);
      if (Number.isFinite(days) && dt < min) return false;
    }
    return true;
  }), [rows, member, source, direction, query, period]);

  return (
    <section className="glass-card p-5">
      <div className="grid gap-2 md:grid-cols-5">
        <select className="saas-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Période: tout</option>
          <option value="1">24h</option>
          <option value="7">7 jours</option>
          <option value="30">30 jours</option>
        </select>
        <select className="saas-input" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">Membre: tous</option>
          {members.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select className="saas-input" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Source: toutes</option>
          {sources.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select className="saas-input" value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="">Montant: tout</option>
          <option value="in">Entrées</option>
          <option value="out">Sorties</option>
        </select>
        <input className="saas-input" placeholder="Recherche libre" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((row) => (
          <article key={row.id} className="group relative rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b1a12]">{moneyMovementIcon(row.type)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#ffe8ca]">{row.user_name} — {humanMoneyMovementLabel(row.type)} — {row.label}</p>
                  <p className="text-xs text-[#efcdab]">{row.source} · {new Date(row.created_at).toLocaleString('fr-FR')}</p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${Number(row.amount) >= 0 ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{formatUsd(Number(row.amount))}</p>
            </div>
            <div className="pointer-events-none absolute left-3 top-full z-20 mt-1 hidden min-w-72 rounded-xl border border-white/10 bg-[#2a180f]/95 p-3 text-xs text-[#f2d2ae] shadow-xl group-hover:block">
              <p className="font-semibold text-[#ffe8c9]">Détail mouvement</p>
              <p>🧭 Source: {row.source}</p>
              <p>🧾 Type: {humanMoneyMovementLabel(row.type)}</p>
              <p>👤 Membre: {row.user_name}</p>
              <p>📉 Avant: {row.before_amount != null ? formatUsd(Number(row.before_amount)) : 'Indisponible'}</p>
              <p>📈 Après: {row.after_amount != null ? formatUsd(Number(row.after_amount)) : 'Indisponible'}</p>
              <p>↕️ Variation: {formatUsd(Number(row.amount))}</p>
              <p>🏷️ Motif: {row.label || '—'}</p>
              {row.related_item_name ? <p>📦 Item concerné: {row.related_item_name}</p> : null}
              <p>🕒 Date / heure: {new Date(row.created_at).toLocaleString('fr-FR')}</p>
              {moneyItemImageUrl ? <Image src={moneyItemImageUrl} alt="Argent" width={42} height={42} className="mt-2 h-10 w-10 rounded-lg border border-white/10" unoptimized /> : null}
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-[#f1d2ae]">Aucun mouvement trouvé.</p> : null}
      </div>
    </section>
  );
}
