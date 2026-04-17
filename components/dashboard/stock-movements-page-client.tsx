'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { humanStockMovementLabel, stockMovementIcon } from '@/lib/labels';

type Row = {
  id: number;
  item: string;
  quantity: number;
  type: string;
  created_at: string;
  user_name: string;
  image: string | null;
  category: string | null;
  source: string;
  before: number | null;
  after: number | null;
};

export function StockMovementsPageClient({ rows }: { rows: Row[] }) {
  const [period, setPeriod] = useState('');
  const [member, setMember] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');

  const members = useMemo(() => Array.from(new Set(rows.map((row) => row.user_name))).sort((a, b) => a.localeCompare(b, 'fr')), [rows]);
  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category || 'Sans catégorie'))).sort((a, b) => a.localeCompare(b, 'fr')), [rows]);
  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.source))).sort((a, b) => a.localeCompare(b, 'fr')), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (member && row.user_name !== member) return false;
    if (category && (row.category || 'Sans catégorie') !== category) return false;
    if (source && row.source !== source) return false;
    if (type === 'in' && row.quantity <= 0) return false;
    if (type === 'out' && row.quantity >= 0) return false;
    if (query) {
      const q = query.toLowerCase();
      const blob = `${row.item} ${row.user_name} ${row.source} ${humanStockMovementLabel(row.type)}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (period) {
      const days = Number(period);
      const dt = new Date(row.created_at).getTime();
      const min = Date.now() - (days * 24 * 3600 * 1000);
      if (Number.isFinite(days) && dt < min) return false;
    }
    return true;
  }), [rows, member, category, source, type, query, period]);

  return (
    <section className="glass-card p-5">
      <div className="grid gap-2 md:grid-cols-6">
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
        <select className="saas-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Catégorie: toutes</option>
          {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select className="saas-input" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Source: toutes</option>
          {sources.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select className="saas-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Type: tout</option>
          <option value="in">Entrées</option>
          <option value="out">Sorties</option>
        </select>
        <input className="saas-input" placeholder="Recherche item / texte" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((row) => (
          <article key={row.id} className="group relative rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b1a12]">{stockMovementIcon(row.type, row.quantity)}</span>
                {row.image ? <Image src={row.image} alt={row.item} width={34} height={34} className="h-8 w-8 rounded-md border border-white/10" unoptimized /> : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#ffe8ca]">{row.user_name} — {row.item}</p>
                  <p className="text-xs text-[#efcdab]">{row.source} · {humanStockMovementLabel(row.type)} · {new Date(row.created_at).toLocaleString('fr-FR')}</p>
                  <p className="text-[11px] text-[#efcdab]">Avant {row.before != null ? row.before : '—'} → Après {row.after != null ? row.after : '—'}</p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${row.quantity >= 0 ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{row.quantity > 0 ? '+' : ''}{row.quantity}</p>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-[#f1d2ae]">Aucun mouvement trouvé.</p> : null}
      </div>
    </section>
  );
}
