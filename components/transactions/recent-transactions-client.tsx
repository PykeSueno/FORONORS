'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { humanStockMovementLabel } from '@/lib/labels';

type RecentTransaction = {
  id: number;
  actor_user_id: string | null;
  reason: string;
  member_label: string;
  total_money_in: number;
  total_money_out: number;
  profit_loss: number;
  created_at: string;
  transaction_lines: Array<{
    item_id?: number;
    item_name_snapshot: string;
    quantity: number;
    movement_type: 'purchase' | 'sale' | 'stock_in' | 'stock_out';
    unit_price?: number;
    total_amount?: number;
    items: { image_url: string | null; category_key?: string | null; type_key?: string | null } | Array<{ image_url: string | null; category_key?: string | null; type_key?: string | null }> | null;
  }>;
};

export function RecentTransactionsClient({
  transactions,
  canEditOwn,
  canEditAny,
  canCancelOwn,
  canCancelAny,
  currentUserId
}: {
  transactions: RecentTransaction[];
  canEditOwn: boolean;
  canEditAny: boolean;
  canCancelOwn: boolean;
  canCancelAny: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [member, setMember] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [movementType, setMovementType] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [category, setCategory] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [flow, setFlow] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<RecentTransaction | null>(null);

  const members = useMemo(() => Array.from(new Set(transactions.map((entry) => entry.member_label))).sort(), [transactions]);
  const availableTypes = useMemo(() => {
    if (!category) return [];
    const values = new Set<string>();
    for (const tx of transactions) {
      for (const line of tx.transaction_lines) {
        const item = Array.isArray(line.items) ? line.items[0] : line.items;
        if ((item?.category_key ?? 'other') === category && item?.type_key) values.add(item.type_key);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [transactions, category]);

  const filtered = useMemo(() => {
    return transactions.filter((transaction) => {
      const textMatch = !query || `${transaction.reason} ${transaction.member_label} ${transaction.id}`.toLowerCase().includes(query.toLowerCase());
      const memberMatch = !member || transaction.member_label === member;
      const dateValue = new Date(transaction.created_at);
      const fromMatch = !fromDate || dateValue >= new Date(`${fromDate}T00:00:00`);
      const toMatch = !toDate || dateValue <= new Date(`${toDate}T23:59:59`);
      const movementMatch = !movementType || transaction.transaction_lines.some((line) => line.movement_type === movementType);
      const itemMatch = !itemQuery || transaction.transaction_lines.some((line) => line.item_name_snapshot.toLowerCase().includes(itemQuery.toLowerCase()));
      const categoryMatch = !category || transaction.transaction_lines.some((line) => {
        const item = Array.isArray(line.items) ? line.items[0] : line.items;
        return (item?.category_key ?? 'other') === category;
      });
      const typeMatch = !typeFilter || transaction.transaction_lines.some((line) => {
        const item = Array.isArray(line.items) ? line.items[0] : line.items;
        return (item?.type_key ?? '') === typeFilter;
      });

      const flowMatch = !flow
        || (flow === 'entry' && Number(transaction.total_money_in) > 0)
        || (flow === 'exit' && Number(transaction.total_money_out) > 0)
        || (flow === 'balanced' && Number(transaction.total_money_in) === 0 && Number(transaction.total_money_out) === 0);

      return textMatch && memberMatch && fromMatch && toMatch && movementMatch && itemMatch && flowMatch && categoryMatch && typeMatch;
    });
  }, [transactions, query, member, fromDate, toDate, movementType, itemQuery, flow, category, typeFilter]);

  async function cancelTransaction(id: number) {
    const response = await fetch(`/api/transactions/recent/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Annulation impossible.');
      return;
    }
    router.refresh();
  }

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
          <div className="flex flex-wrap gap-1">
            {[
              { key: '', label: 'Tous' },
              { key: 'objects', label: 'Objets' },
              { key: 'weapons', label: 'Armes' },
              { key: 'equipment', label: 'Équipement' },
              { key: 'drugs', label: 'Drogues' },
              { key: 'other', label: 'Autres' }
            ].map((entry) => (
              <button key={entry.key || 'all'} type="button" className={`filter-pill ${category === entry.key ? 'filter-pill-active' : ''}`} onClick={() => { setCategory(entry.key); setTypeFilter(''); }}>
                {entry.label}
              </button>
            ))}
          </div>
          {availableTypes.length > 0 ? (
            <select className="saas-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tous les sous-types</option>
              {availableTypes.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          ) : <div />}
          <select className="saas-input" value={flow} onChange={(e) => setFlow(e.target.value)}>
            <option value="">Tous les flux argent</option>
            <option value="entry">Entrée</option>
            <option value="exit">Sortie</option>
            <option value="balanced">Sans mouvement argent</option>
          </select>
          <button className="saas-ghost-btn" onClick={() => { setQuery(''); setMember(''); setFromDate(''); setToDate(''); setMovementType(''); setItemQuery(''); setFlow(''); setCategory(''); setTypeFilter(''); }}>
            Réinitialiser
          </button>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}

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
                       <p className="text-xs text-[#efd0aa]">{humanStockMovementLabel(line.movement_type)} · Total {formatUsd(Number(line.total_amount ?? Number(line.quantity) * Number(line.unit_price ?? 0)))}</p>
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

            {(() => {
              const canEditThis = canEditAny || (canEditOwn && transaction.actor_user_id === currentUserId);
              const canCancelThis = canCancelAny || (canCancelOwn && transaction.actor_user_id === currentUserId);
              if (!canEditThis && !canCancelThis) return null;
              return (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {canEditThis ? <button className="saas-ghost-btn" onClick={() => setEditing(transaction)}>Modifier</button> : null}
                {canCancelThis ? <button className="saas-ghost-btn" onClick={() => void cancelTransaction(transaction.id)}>Annuler</button> : null}
              </div>
            );
            })()}
          </article>
        ))}

        {filtered.length === 0 ? <p className="glass-card p-4 text-sm text-[#f3d4b0]">Aucune transaction ne correspond aux filtres.</p> : null}
      </section>

      {editing ? <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} onError={setError} /> : null}
    </div>
  );
}

function EditTransactionModal({ transaction, onClose, onError }: { transaction: RecentTransaction; onClose: () => void; onError: (message: string) => void }) {
  const [reason, setReason] = useState(transaction.reason);
  const [memberLabel, setMemberLabel] = useState(transaction.member_label);
  const [lines, setLines] = useState(transaction.transaction_lines.map((line) => ({
    item_id: Number(line.item_id ?? 0),
    item_name: line.item_name_snapshot,
    image_url: Array.isArray(line.items) ? line.items[0]?.image_url ?? null : line.items?.image_url ?? null,
    movement_type: line.movement_type,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price ?? 0),
    manual_total: Number(line.total_amount ?? Number(line.quantity) * Number(line.unit_price ?? 0))
  })));
  const [stockByItemId, setStockByItemId] = useState<Record<number, number>>({});

  function updateLine(index: number, patch: Partial<typeof lines[number]>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }


  useEffect(() => {
    const ids = Array.from(new Set(lines.map((line) => line.item_id).filter((id) => id > 0)));
    if (ids.length === 0) return;

    void fetch('/api/items')
      .then((response) => response.ok ? response.json() as Promise<{ items: Array<{ id: number; quantity: number }> }> : null)
      .then((data) => {
        if (!data) return;
        const next: Record<number, number> = {};
        for (const item of data.items) {
          if (ids.includes(item.id)) next[item.id] = Number(item.quantity);
        }
        setStockByItemId(next);
      })
      .catch(() => undefined);
  }, [lines]);

  async function save() {
    const response = await fetch(`/api/transactions/recent/${transaction.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, member_label: memberLabel, lines: lines.map((line) => ({ item_id: line.item_id, movement_type: line.movement_type, quantity: line.quantity, unit_price: line.unit_price, manual_total: line.manual_total })) })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      onError(data.message ?? 'Modification impossible.');
      return;
    }

    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <div className="glass-card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff0db]">Modifier transaction #{transaction.id}</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <div className="space-y-3">
          <input className="saas-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif" />
          <input className="saas-input w-full" value={memberLabel} onChange={(e) => setMemberLabel(e.target.value)} placeholder="Membre" />

          {lines.map((line, index) => (
            <div key={index} className="rounded-xl border border-white/10 bg-[#4f3220]/45 p-3">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-[#23140e]">
                  {line.image_url ? <Image src={line.image_url} alt={line.item_name} width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#efcdab]">🖼️</div>}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#ffe9cd]">{line.item_name}</p>
                  <p className="text-xs text-[#efcdab]">Stock actuel: {stockByItemId[line.item_id] ?? '—'}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs text-[#efcdab]">Type de mouvement</p>
                  <select className="saas-input" value={line.movement_type} onChange={(e) => updateLine(index, { movement_type: e.target.value as 'purchase' | 'sale' | 'stock_in' | 'stock_out' })}>
                    <option value="stock_in">Entrée</option>
                    <option value="stock_out">Sortie</option>
                    <option value="purchase">Achat</option>
                    <option value="sale">Vente</option>
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-[#efcdab]">Quantité</p>
                  <input className="saas-input min-w-24" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-[#efcdab]">Prix unitaire</p>
                  <input className="saas-input" value={line.unit_price} onChange={(e) => updateLine(index, { unit_price: Math.max(0, Number(e.target.value || 0)) })} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-[#efcdab]">Total ligne</p>
                  <input className="saas-input" value={line.manual_total} onChange={(e) => updateLine(index, { manual_total: Math.max(0, Number(e.target.value || 0)) })} />
                  <p className="mt-1 text-[10px] text-[#ffe8ca]">Total modifié</p>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-2">
            <button className="saas-ghost-btn" onClick={onClose}>Annuler</button>
            <button className="saas-primary-btn" onClick={() => void save()}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
