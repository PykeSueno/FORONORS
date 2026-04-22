'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { ITEM_CATEGORIES } from '@/lib/items';

type Item = {
  id: number;
  name: string;
  image_url: string | null;
  buy_price: number;
  sell_price: number;
  quantity: number;
  is_money_item: boolean;
  category_key: string;
  type_key: string | null;
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
  defaultMemberLabel,
  defaultMemberId
}: {
  canCreate: boolean;
  items: Item[];
  members: Member[];
  defaultMemberLabel: string;
  defaultMemberId: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState('');
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [defaultMovementType, setDefaultMovementType] = useState<MovementType>('sale');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const availableTypes = ITEM_CATEGORIES.find((entry) => entry.key === categoryFilter)?.types ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const qOk = !query || item.name.toLowerCase().includes(query.toLowerCase());
      const categoryOk = !categoryFilter || item.category_key === categoryFilter;
      const typeOk = !typeFilter || item.type_key === typeFilter;
      return qOk && categoryOk && typeOk;
    });
  }, [items, query, categoryFilter, typeFilter]);

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
    const defaultPrice = defaultMovementType === 'purchase' ? Number(item.buy_price || 0) : Number(item.sell_price || 0);
    setLines((current) => [...current, { item_id: item.id, movement_type: defaultMovementType, quantity: 1, unit_price: defaultPrice }]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  async function submit() {
    setError('');
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

    setLines([]);
    setReason('');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#fff1dd]">Ajouter des items</h2>
          <input className="saas-input mt-3 w-full" placeholder="Rechercher un item" value={query} onChange={(e) => setQuery(e.target.value)} />

          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`filter-pill ${!categoryFilter ? 'filter-pill-active' : ''}`} onClick={() => { setCategoryFilter(''); setTypeFilter(''); }}>Tous</button>
            {ITEM_CATEGORIES.map((category) => (
              <button key={category.key} className={`filter-pill ${categoryFilter === category.key ? 'filter-pill-active' : ''}`} onClick={() => { setCategoryFilter(category.key); setTypeFilter(''); }}>{category.label}</button>
            ))}
          </div>

          {availableTypes.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={`filter-pill ${!typeFilter ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter('')}>Tous types</button>
              {availableTypes.map((type) => (
                <button key={type.key} className={`filter-pill ${typeFilter === type.key ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter(type.key)}>{type.label}</button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <button key={item.id} className="rounded-xl border border-white/15 bg-[#3f281b]/60 p-3 text-left smooth-hover" onClick={() => addItem(item)}>
                <div className="mb-2 h-20 rounded-lg bg-[#22140e]">
                  {item.image_url ? <Image src={item.image_url} alt={item.name} width={280} height={120} className="h-full w-full rounded-lg object-cover" unoptimized /> : null}
                </div>
                <p className="font-medium text-[#ffe8c9]">{item.name}</p>
                <p className="text-xs text-[#f3d2ad]">Stock: {item.quantity}</p>
                {item.name.toLowerCase() === 'pack meth' ? <p className="text-[11px] text-[#bff0b9]">🧪 1 Pack Meth = 1 table de meth</p> : null}
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

            <label className="mt-3 block text-xs text-[#efccaa]">Type de mouvement par défaut</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['purchase', 'sale', 'stock_in', 'stock_out'] as MovementType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`filter-pill w-full ${defaultMovementType === type ? 'filter-pill-active' : ''}`}
                  onClick={() => setDefaultMovementType(type)}
                >
                  {MOVEMENT_META[type].label}
                </button>
              ))}
            </div>
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
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-lg bg-[#23140e]">
                        {item.image_url ? <Image src={item.image_url} alt={item.name} width={80} height={80} className="h-full w-full object-cover" unoptimized /> : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#ffe8c9]">{item.name}</p>
                        <p className={`mt-0.5 text-xs ${meta.tone}`}>{meta.icon} {meta.label}</p>
                        {item.name.toLowerCase() === 'pack meth' ? <p className="mt-0.5 text-xs text-[#bff0b9]">🧪 Équivalence: 1 Pack = 1 table meth</p> : null}
                        <p className="mt-0.5 text-xs text-[#f4d4b0]">📦 Stock actuel: <span className="font-semibold text-[#ffe9cd]">{item.quantity}</span></p>
                      </div>
                    </div>

                    <div className="mt-3 grid items-end gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_9rem_8rem_8rem_auto]">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs text-[#efcdab]">Type de mouvement</p>
                        <select className="saas-input !h-8 !min-h-8 w-full text-sm" value={line.movement_type} onChange={(e) => updateLine(idx, { movement_type: e.target.value as MovementType })}>
                          <option value="stock_in">Entrée</option>
                          <option value="stock_out">Sortie</option>
                          <option value="purchase">Achat</option>
                          <option value="sale">Vente</option>
                        </select>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-[#efcdab]">Quantité</p>
                        <div className="flex h-8 items-center gap-1">
                          <button type="button" className="saas-ghost-btn !h-8 !min-h-8 !px-2 !py-0" onClick={() => updateLine(idx, { quantity: Math.max(1, line.quantity - 1) })}>-</button>
                          <input className="saas-input !h-8 w-14 text-center text-sm" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                          <button type="button" className="saas-ghost-btn !h-8 !min-h-8 !px-2 !py-0" onClick={() => updateLine(idx, { quantity: line.quantity + 1 })}>+</button>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-[#efcdab]">Prix unitaire</p>
                        <input className="saas-input !h-8 !min-h-8 w-full text-sm" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: Math.max(0, Number(e.target.value || 0)) })} />
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-[#efcdab]">Total ligne</p>
                        <p className="saas-input !h-8 !min-h-8 flex items-center text-sm">{formatUsd(lineTotal)}</p>
                      </div>

                      <div className="flex items-end justify-end">
                        <button type="button" className="saas-ghost-btn !h-8 !min-h-8 !px-3 text-xs" onClick={() => removeLine(idx)}>Supprimer</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="glass-card p-6">
            <h3 className="text-lg font-semibold text-[#fff1dd]">C. Résultat</h3>
            <div className="mt-3 grid gap-2">
              <ResultRow icon="💵" label="Entrée argent" value={`+${formatUsd(totals.moneyIn)}`} positive />
              <ResultRow icon="💸" label="Sortie argent" value={`-${formatUsd(totals.moneyOut)}`} />
              <ResultRow icon="📦" label="Entrée stock" value={`+${totals.stockIn}`} positive />
              <ResultRow icon="📤" label="Sortie stock" value={`-${totals.stockOut}`} />
            </div>
            <div className={`mt-4 rounded-xl border px-4 py-3 ${totals.profit >= 0 ? 'border-[#83d89f]/40 bg-[#83d89f]/10 text-[#cbf5d6]' : 'border-[#e08f8f]/40 bg-[#e08f8f]/10 text-[#f8caca]'}`}>
              <p className="text-xs uppercase tracking-wider">Résultat final</p>
              <p className="text-2xl font-bold">{formatUsd(totals.profit)}</p>
            </div>
            {canCreate ? <button className="saas-primary-btn mt-4 w-full" onClick={() => void submit()}>Valider transaction</button> : null}
          </section>
        </section>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}

function ResultRow({ icon, label, value, positive }: { icon: string; label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
      <p className="text-sm text-[#f3d4b0]">{icon} {label}</p>
      <p className={`text-sm font-semibold ${positive ? 'text-[#c5f2b9]' : 'text-[#f2b9b9]'}`}>{value}</p>
    </div>
  );
}
