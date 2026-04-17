'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { ITEM_CATEGORIES } from '@/lib/items';

type Member = { id: string; name: string; username: string };
type Item = { id: number; name: string; image_url: string | null; quantity: number; buy_price?: number; sell_price?: number; category_key?: string | null };
type LineKind = 'buy' | 'sell';

type FourLine = { id?: number; item_id: number; item_name: string; movement_kind: LineKind; quantity: number; unit_price: number; total_amount: number };
type FourTx = { id: number; counterparty: string | null; status?: 'validated' | 'canceled'; cancel_reason?: string | null; created_by?: string | null; total_purchases: number; total_sales: number; profit_loss: number; created_at: string; updated_at?: string; four_transaction_lines: FourLine[] };
type FourSession = {
  id: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  summary?: Record<string, unknown> | null;
  managed_by?: string | null;
  users?: { name?: string | null; username?: string | null } | Array<{ name?: string | null; username?: string | null }> | null;
  four_transactions: FourTx[];
};
type FourHistory = { id: number; closed_at: string | null; summary?: Record<string, unknown> | null };
type FourMessage = { id: number; title: string; content: string; display_order: number };
type FourStats = {
  totals: { sessions: number; purchases: number; sales: number; profit: number };
  byMember: Record<string, { sessions: number; profit: number }>;
  byCounterparty: Record<string, { purchases: number; sales: number; count: number }>;
  byItem: Array<{ name: string; item_id: number | null; image_url: string | null; bought: number; sold: number; volume: number }>;
  sessions: FourSession[];
};

export function FourPageClient({ members, items, activeSession, canOpen, canCashAdd, canManageTransaction, canValidateTransaction, canManageOwnTransaction, canManageAnyTransaction, canClose, canViewStats, canViewMessages, canManageMessages, currentUserId }: {
  members: Member[];
  items: Item[];
  activeSession: FourSession | null;
  history: FourHistory[];
  canOpen: boolean;
  canCashAdd: boolean;
  canManageTransaction: boolean;
  canValidateTransaction: boolean;
  canManageOwnTransaction: boolean;
  canManageAnyTransaction: boolean;
  canClose: boolean;
  canViewHistory: boolean;
  canViewStats: boolean;
  canViewMessages: boolean;
  canManageMessages: boolean;
  currentUserId: string;
}) {
  const [session, setSession] = useState<FourSession | null>(activeSession);
  const [openingMemberId, setOpeningMemberId] = useState(currentUserId);
  const [initialCash, setInitialCash] = useState(0);
  const [cashAddAmount, setCashAddAmount] = useState(0);
  const [draftKind, setDraftKind] = useState<LineKind>('sell');
  const [draftLines, setDraftLines] = useState<FourLine[]>([]);
  const [counterparty, setCounterparty] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'session' | 'stats' | 'messages'>('session');
  const [stats, setStats] = useState<FourStats | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);
  const [messages, setMessages] = useState<FourMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState({ id: 0, title: '', content: '', display_order: 100 });
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  const filteredItems = useMemo(() => items.filter((item) => {
    const qOk = !query || item.name.toLowerCase().includes(query.toLowerCase());
    const cOk = !categoryFilter || item.category_key === categoryFilter;
    return qOk && cOk;
  }), [items, query, categoryFilter]);

  const validatedTotals = useMemo(() => {
    const txs = (session?.four_transactions ?? []).filter((tx) => (tx.status ?? 'validated') === 'validated');
    const purchases = txs.reduce((sum, tx) => sum + Number(tx.total_purchases ?? 0), 0);
    const sales = txs.reduce((sum, tx) => sum + Number(tx.total_sales ?? 0), 0);
    return { purchases, sales, profit: sales - purchases };
  }, [session]);

  const draftTotals = useMemo(() => {
    const purchases = draftLines.filter((line) => line.movement_kind === 'buy').reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0);
    const sales = draftLines.filter((line) => line.movement_kind === 'sell').reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0);
    return { purchases, sales, profit: sales - purchases };
  }, [draftLines]);

  const summary = useMemo(() => {
    const initial = Number(session?.summary?.initial_cash ?? 0);
    const added = Number(session?.summary?.cash_added_total ?? 0);
    const cash = initial + added + validatedTotals.profit;
    return { initial, added, cash, purchases: validatedTotals.purchases, sales: validatedTotals.sales, profit: validatedTotals.profit };
  }, [session, validatedTotals]);

  const selectedHistory = useMemo(() => (stats?.sessions ?? []).find((entry) => entry.id === selectedSessionId) ?? null, [stats, selectedSessionId]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const visibleSessionTransactions = useMemo(
    () => (session?.four_transactions ?? []).filter((tx) => (tx.status ?? 'validated') === 'validated'),
    [session]
  );

  async function fetchActiveSession() {
    const response = await fetch('/api/four', { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json() as { active: FourSession | null };
    setSession(data.active ?? null);
    return data.active ?? null;
  }

  async function openSession() {
    setError('');
    const response = await fetch('/api/four', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managed_by: openingMemberId, initial_cash: initialCash })
    });
    if (!response.ok) return setError((await response.json()).message ?? 'Ouverture impossible.');
    setDraftLines([]);
    await fetchActiveSession();
  }

  async function addCash() {
    const latest = await fetchActiveSession();
    if (!latest?.id || cashAddAmount <= 0) return;
    const response = await fetch('/api/four/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: latest.id, amount: cashAddAmount })
    });
    if (!response.ok) return setError((await response.json()).message ?? 'Ajout cash impossible.');
    setCashAddAmount(0);
    await fetchActiveSession();
  }

  function addItemToDraft(item: Item) {
    const unitPrice = draftKind === 'buy' ? Number(item.buy_price ?? 0) : Number(item.sell_price ?? 0);
    setDraftLines((current) => [...current, { item_id: item.id, item_name: item.name, movement_kind: draftKind, quantity: 1, unit_price: unitPrice, total_amount: unitPrice }]);
  }

  function updateDraftLine(index: number, patch: Partial<FourLine>) {
    setDraftLines((current) => current.map((line, idx) => {
      if (idx !== index) return line;
      const next = { ...line, ...patch };
      next.total_amount = Number(next.quantity) * Number(next.unit_price);
      return next;
    }));
  }

  function removeDraftLine(index: number) {
    setDraftLines((current) => current.filter((_, idx) => idx !== index));
  }

  async function validateTransaction() {
    const latest = await fetchActiveSession();
    if (!latest?.id || draftLines.length === 0) return;
    const response = await fetch('/api/four/transactions', {
      method: editingTxId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingTxId
        ? { transaction_id: editingTxId, counterparty, lines: draftLines.map((line) => ({ item_id: line.item_id, movement_kind: line.movement_kind, quantity: line.quantity, unit_price: line.unit_price })) }
        : { session_id: latest.id, counterparty, lines: draftLines.map((line) => ({ item_id: line.item_id, movement_kind: line.movement_kind, quantity: line.quantity, unit_price: line.unit_price })) })
    });
    if (!response.ok) {
      const payload = await response.json();
      await fetchActiveSession();
      return setError(payload.message ?? 'Validation impossible.');
    }
    setDraftLines([]);
    setCounterparty('');
    setEditingTxId(null);
    await fetchActiveSession();
  }

  function canManageExistingTx(tx: FourTx) {
    if (canManageAnyTransaction) return true;
    if (canManageOwnTransaction && tx.created_by && tx.created_by === currentUserId) return true;
    return false;
  }

  function loadTxForEdit(tx: FourTx) {
    if ((tx.status ?? 'validated') !== 'validated') return;
    setEditingTxId(tx.id);
    setCounterparty(tx.counterparty || '');
    setDraftLines((tx.four_transaction_lines ?? []).map((line) => ({
      id: line.id,
      item_id: line.item_id,
      item_name: line.item_name,
      movement_kind: line.movement_kind,
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price),
      total_amount: Number(line.total_amount)
    })));
  }

  async function cancelTx(txId: number) {
    const response = await fetch('/api/four/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: txId, reason: 'Annulation depuis interface FOUR' })
    });
    if (!response.ok) return setError((await response.json()).message ?? 'Annulation impossible.');
    await fetchActiveSession();
  }

  async function closeSession() {
    const latest = await fetchActiveSession();
    if (!latest?.id) return;
    const response = await fetch('/api/four', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: latest.id }) });
    if (!response.ok) return setError((await response.json()).message ?? 'Clôture impossible.');
    setSession(null);
    setDraftLines([]);
  }

  async function loadStats() {
    const res = await fetch('/api/four/stats', { cache: 'no-store' });
    if (!res.ok) return;
    const payload = await res.json() as FourStats;
    setStats(payload);
    if (!selectedSessionId && payload.sessions.length > 0) setSelectedSessionId(payload.sessions[0].id);
  }

  async function loadMessages() {
    const res = await fetch('/api/four/messages', { cache: 'no-store' });
    if (res.ok) setMessages((await res.json()).messages ?? []);
  }

  async function saveMessage() {
    const res = await fetch('/api/four/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: messageDraft.id || undefined, title: messageDraft.title, content: messageDraft.content, display_order: messageDraft.display_order }) });
    if (res.ok) {
      setMessageDraft({ id: 0, title: '', content: '', display_order: 100 });
      await loadMessages();
    }
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-[#fff1dd]">FOUR</h3>
            <p className="text-xs text-[#efcdab]">{session ? `Session #${session.id} ouverte` : 'Aucune session ouverte'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`filter-pill ${activeTab === 'session' ? 'filter-pill-active' : ''}`} onClick={() => setActiveTab('session')}>Session</button>
            {canViewStats ? <button className={`filter-pill ${activeTab === 'stats' ? 'filter-pill-active' : ''}`} onClick={() => { setActiveTab('stats'); void loadStats(); }}>Stats</button> : null}
            {canViewMessages ? <button className={`filter-pill ${activeTab === 'messages' ? 'filter-pill-active' : ''}`} onClick={() => { setActiveTab('messages'); void loadMessages(); }}>Messages</button> : null}
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          {!session && canOpen ? (
            <>
              <select className="saas-input w-full" value={openingMemberId} onChange={(e) => setOpeningMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.username}</option>)}
              </select>
              <input className="saas-input w-full" value={initialCash} onChange={(e) => setInitialCash(Math.max(0, Number(e.target.value || 0)))} placeholder="Cash initial" />
              <button className="saas-primary-btn" onClick={() => void openSession()}>Ouvrir le FOUR</button>
            </>
          ) : null}

          {session && canCashAdd ? (
            <>
              <input className="saas-input w-full" value={cashAddAmount} onChange={(e) => setCashAddAmount(Math.max(0, Number(e.target.value || 0)))} placeholder="Ajouter du cash" />
              <button className="saas-ghost-btn" onClick={() => void addCash()}>Ajouter cash</button>
            </>
          ) : null}

          {session && canClose ? <button className="saas-primary-btn" onClick={() => void closeSession()}>Fermer le FOUR</button> : null}
        </div>
      </section>

      {activeTab === 'session' ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <article className="glass-card p-5 space-y-3">
              <h3 className="text-base font-semibold text-[#fff1dd]">Catalogue items</h3>
              <input className="saas-input w-full" placeholder="Recherche item" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="saas-input w-full" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Toutes catégories</option>
                {ITEM_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <div className="max-h-[520px] space-y-2 overflow-y-auto">
                {filteredItems.map((item) => (
                  <button key={item.id} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#2e1d14]/65 px-3 py-2 text-left disabled:opacity-60" disabled={!session || !canManageTransaction} onClick={() => addItemToDraft(item)}>
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#23140e]">{item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}</div>
                    <div>
                      <p className="text-sm text-[#ffe8ca]">{item.name}</p>
                      <p className="text-xs text-[#efcdab]">{ITEM_CATEGORIES.find((entry) => entry.key === item.category_key)?.label ?? item.category_key ?? 'Catégorie'} · Stock {item.quantity}</p>
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <article className="glass-card p-5 space-y-3">
              <h3 className="text-base font-semibold text-[#fff1dd]">{editingTxId ? `Édition transaction #${editingTxId}` : 'Transaction en cours'}</h3>
              <input className="saas-input w-full" placeholder="Interlocuteur / client / groupe" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />

              <div className="grid gap-2 sm:grid-cols-2">
                <button className={`filter-pill w-full ${draftKind === 'buy' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('buy')}>Achat par défaut</button>
                <button className={`filter-pill w-full ${draftKind === 'sell' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('sell')}>Vente par défaut</button>
              </div>

              <div className="space-y-2">
                {draftLines.map((line, index) => {
                  const item = items.find((entry) => entry.id === line.item_id);
                  const categoryLabel = ITEM_CATEGORIES.find((entry) => entry.key === item?.category_key)?.label ?? item?.category_key ?? 'Catégorie';
                  return (
                    <div key={`${line.item_id}-${index}`} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
                        <div className="h-14 w-14 overflow-hidden rounded-lg bg-[#23140e]">{item?.image_url ? <Image src={item.image_url} alt={line.item_name} width={56} height={56} className="h-full w-full object-cover" unoptimized /> : null}</div>
                        <div className="min-w-0 space-y-2">
                          <div>
                            <p className="font-medium text-[#ffe8ca]">{line.item_name}</p>
                            <p className="text-xs text-[#efcdab]">{categoryLabel} · Stock actuel {item?.quantity ?? 0}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select className="saas-input" value={line.movement_kind} onChange={(e) => updateDraftLine(index, { movement_kind: e.target.value as LineKind })}>
                              <option value="buy">Achat</option>
                              <option value="sell">Vente</option>
                            </select>
                            <button className="saas-ghost-btn !px-2 !py-1" onClick={() => updateDraftLine(index, { quantity: Math.max(1, line.quantity - 1) })}>-</button>
                            <input className="saas-input w-20 text-center" value={line.quantity} onChange={(e) => updateDraftLine(index, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                            <button className="saas-ghost-btn !px-2 !py-1" onClick={() => updateDraftLine(index, { quantity: line.quantity + 1 })}>+</button>
                            <input className="saas-input w-28 text-center" value={line.unit_price} onChange={(e) => updateDraftLine(index, { unit_price: Math.max(0, Number(e.target.value || 0)) })} />
                            <p className="rounded-lg border border-[#f8d7a2]/35 bg-[#5a3825]/70 px-3 py-2 text-sm font-semibold text-[#ffe8ca]">{formatUsd(line.quantity * line.unit_price)}</p>
                            <button className="saas-ghost-btn !px-2 !py-1" onClick={() => removeDraftLine(index)}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {draftLines.length === 0 ? <p className="text-sm text-[#f3d5b4]">Aucune ligne en cours.</p> : null}
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <SummaryLine label="Achats transaction" value={formatUsd(draftTotals.purchases)} danger />
                <SummaryLine label="Ventes transaction" value={formatUsd(draftTotals.sales)} positive />
                <SummaryLine label="Résultat transaction" value={formatUsd(draftTotals.profit)} positive={draftTotals.profit >= 0} danger={draftTotals.profit < 0} />
              </div>

              {canValidateTransaction ? <button className="saas-primary-btn w-full" onClick={() => void validateTransaction()}>{editingTxId ? 'Enregistrer la modification' : 'Valider la transaction'}</button> : null}
              {editingTxId ? <button className="saas-ghost-btn w-full" onClick={() => { setEditingTxId(null); setDraftLines([]); setCounterparty(''); }}>Annuler l’édition</button> : null}

              <div className="rounded-xl border border-white/10 bg-[#2e1d14]/45 p-3">
                <p className="text-sm font-semibold text-[#fff1dd]">Transactions session ({visibleSessionTransactions.length})</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {visibleSessionTransactions.map((tx) => {
                    const expanded = expandedTxId === tx.id;
                    return (
                      <div key={tx.id} className="rounded-lg border border-white/10 bg-[#3f281b]/50">
                        <button className="w-full px-3 py-2 text-left" onClick={() => setExpandedTxId(expanded ? null : tx.id)}>
                          <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[#ffe8ca]">Transaction #{tx.id}</p><span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">VALIDÉE</span></div>
                          <p className="text-xs text-[#efcdab]">🧑 Interlocuteur : {tx.counterparty || 'Inconnu'} · 🕒 {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="text-xs text-[#efcdab]">Ventes {formatUsd(Number(tx.total_sales))} · Achats {formatUsd(Number(tx.total_purchases))} · Résultat {formatUsd(Number(tx.profit_loss))}</p>
                        </button>
                        {expanded ? (
                          <div className="space-y-2 border-t border-white/10 px-3 py-2">
                            {canManageExistingTx(tx) ? (
                              <div className="flex gap-2">
                                <button className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => loadTxForEdit(tx)}>Modifier</button>
                                <button className="saas-ghost-btn !px-2 !py-1 text-xs" onClick={() => void cancelTx(tx.id)}>Annuler</button>
                              </div>
                            ) : null}
                            <p className="text-xs font-semibold text-[#fff1dd]">📦 Détail</p>
                            <div className="space-y-1">
                              {(tx.four_transaction_lines ?? []).map((line, idx) => (
                                <p key={`${tx.id}-${line.id ?? idx}`} className={`rounded-md px-2 py-1 text-xs ${line.movement_kind === 'sell' ? 'bg-[#2d4a34]/45 text-[#d4ffd8]' : 'bg-[#5a2f2f]/45 text-[#ffd6d6]'}`}>
                                  {line.movement_kind === 'sell' ? 'Vente' : 'Achat'} : {line.item_name} x{line.quantity} → {formatUsd(Number(line.total_amount ?? 0))}
                                </p>
                              ))}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <SummaryLine label="Total ventes" value={formatUsd(Number(tx.total_sales))} positive />
                              <SummaryLine label="Total achats" value={formatUsd(Number(tx.total_purchases))} danger />
                              <SummaryLine label="Résultat" value={formatUsd(Number(tx.profit_loss))} positive={Number(tx.profit_loss) >= 0} danger={Number(tx.profit_loss) < 0} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          </section>

          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd] mb-3">Résumé en direct</h3>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <SummaryLine label="Cash départ" value={formatUsd(summary.initial)} />
              <SummaryLine label="Cash ajouté" value={formatUsd(summary.added)} />
              <SummaryLine label="Achats validés" value={formatUsd(summary.purchases)} danger />
              <SummaryLine label="Ventes validées" value={formatUsd(summary.sales)} positive />
              <SummaryLine label="Résultat provisoire" value={formatUsd(summary.profit)} positive={summary.profit >= 0} danger={summary.profit < 0} />
              <SummaryLine label="Cash session" value={formatUsd(summary.cash)} />
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'stats' && canViewStats ? (
        <section className="space-y-4">
          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd] mb-3">Stats FOUR</h3>
            <div className="grid gap-2 md:grid-cols-4">
              <SummaryLine label="📚 Sessions fermées" value={String(stats?.totals.sessions ?? 0)} />
              <SummaryLine label="🛒 Total achats" value={formatUsd(stats?.totals.purchases ?? 0)} danger />
              <SummaryLine label="💸 Total ventes" value={formatUsd(stats?.totals.sales ?? 0)} positive />
              <SummaryLine label="📈 Résultat global" value={formatUsd(stats?.totals.profit ?? 0)} positive={(stats?.totals.profit ?? 0) >= 0} danger={(stats?.totals.profit ?? 0) < 0} />
            </div>
            {!stats ? <button className="saas-primary-btn mt-3" onClick={() => void loadStats()}>Charger les stats</button> : null}
          </section>

          {stats ? (
            <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
              <article className="glass-card p-5 space-y-3">
                <h4 className="text-sm font-semibold text-[#fff1dd]">Historique des sessions FOUR</h4>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {stats.sessions.map((entry) => {
                    const profit = Number(entry.summary?.profit_loss ?? 0);
                    return (
                      <button key={entry.id} className={`w-full rounded-xl border px-3 py-2 text-left ${selectedSessionId === entry.id ? 'border-[#f8d7a2] bg-[#4b2e1f]/70' : 'border-white/10 bg-[#2e1d14]/45'}`} onClick={() => setSelectedSessionId(entry.id)}>
                        <p className="text-sm font-medium text-[#ffe8ca]">Session #{entry.id}</p>
                        <p className="text-xs text-[#efcdab]">🗓️ Fermée: {entry.closed_at ? new Date(entry.closed_at).toLocaleString('fr-FR') : '-'}</p>
                        <p className={`text-xs ${profit >= 0 ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>📊 Résultat: {formatUsd(profit)}</p>
                      </button>
                    );
                  })}
                </div>
              </article>

              <article className="glass-card p-5 space-y-3">
                {selectedHistory ? (
                  <>
                    <h4 className="text-sm font-semibold text-[#fff1dd]">Détail session #{selectedHistory.id}</h4>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <SummaryLine label="Ouverture" value={new Date(selectedHistory.opened_at).toLocaleString('fr-FR')} />
                      <SummaryLine label="Fermeture" value={selectedHistory.closed_at ? new Date(selectedHistory.closed_at).toLocaleString('fr-FR') : '-'} />
                      <SummaryLine label="Cash départ" value={formatUsd(Number(selectedHistory.summary?.initial_cash ?? 0))} />
                      <SummaryLine label="Cash ajouté" value={formatUsd(Number(selectedHistory.summary?.cash_added_total ?? 0))} />
                      <SummaryLine label="Total achats" value={formatUsd(Number(selectedHistory.summary?.total_purchases ?? 0))} danger />
                      <SummaryLine label="Total ventes" value={formatUsd(Number(selectedHistory.summary?.total_sales ?? 0))} positive />
                      <SummaryLine label="Résultat final" value={formatUsd(Number(selectedHistory.summary?.profit_loss ?? 0))} positive={Number(selectedHistory.summary?.profit_loss ?? 0) >= 0} danger={Number(selectedHistory.summary?.profit_loss ?? 0) < 0} />
                      <SummaryLine label="Cash final session" value={formatUsd(Number(selectedHistory.summary?.cash_final ?? 0))} />
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#2e1d14]/45 p-3">
                      <p className="text-sm text-[#fff1dd]">Transactions validées</p>
                      <div className="mt-2 space-y-2 max-h-[320px] overflow-y-auto">
                        {(selectedHistory.four_transactions ?? []).filter((tx) => (tx.status ?? 'validated') === 'validated').map((tx) => (
                          <div key={tx.id} className="rounded-lg border border-white/10 bg-[#3f281b]/50 p-2">
                            <p className="text-xs font-semibold text-[#ffe8ca]">#{tx.id} · {tx.counterparty || '—'} · {new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                            <p className="text-xs text-[#efcdab]">Achats {formatUsd(Number(tx.total_purchases))} · Ventes {formatUsd(Number(tx.total_sales))} · Résultat {formatUsd(Number(tx.profit_loss))}</p>
                            <div className="mt-1 space-y-1">
                              {(tx.four_transaction_lines ?? []).map((line) => (
                                <div key={line.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#2b1a12]/55 px-2 py-1">
                                  <div className="h-8 w-8 overflow-hidden rounded-md bg-[#23140e]">
                                    {line.item_id && itemById.get(line.item_id)?.image_url ? <Image src={itemById.get(line.item_id)?.image_url as string} alt={line.item_name} width={32} height={32} className="h-full w-full object-cover" unoptimized /> : null}
                                  </div>
                                  <p className="text-xs text-[#efcdab]">{line.movement_kind === 'buy' ? '🟥 Achat' : '🟩 Vente'} · {line.item_name} · Qté {line.quantity} · PU {formatUsd(Number(line.unit_price))} · Total {formatUsd(Number(line.total_amount))}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : <p className="text-sm text-[#efcdab]">Sélectionnez une session pour voir son détail.</p>}
              </article>
            </section>
          ) : null}

          {stats ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <article className="glass-card p-5">
                <h4 className="text-sm font-semibold text-[#fff1dd] mb-2">Stats par membre</h4>
                <div className="space-y-1">
                  {Object.entries(stats.byMember).map(([name, data]) => <p key={name} className="text-xs text-[#efcdab]">{name} · Sessions {data.sessions} · Résultat {formatUsd(data.profit)}</p>)}
                </div>
              </article>
              <article className="glass-card p-5">
                <h4 className="text-sm font-semibold text-[#fff1dd] mb-2">Stats par client / groupe</h4>
                {Object.entries(stats.byCounterparty).length > 0 ? (
                  <p className="mb-2 text-xs text-[#bff0b9]">🏆 Top client: {Object.entries(stats.byCounterparty).sort((a, b) => (b[1].sales - b[1].purchases) - (a[1].sales - a[1].purchases))[0][0]}</p>
                ) : null}
                <div className="space-y-1">
                  {Object.entries(stats.byCounterparty).map(([name, data]) => <p key={name} className="text-xs text-[#efcdab]">{name} · Tx {data.count} · Achats {formatUsd(data.purchases)} · Ventes {formatUsd(data.sales)}</p>)}
                </div>
              </article>
            </section>
          ) : null}
          {stats ? (
            <section className="glass-card p-5">
              <h4 className="mb-2 text-sm font-semibold text-[#fff1dd]">Stats détaillées par item</h4>
              <div className="space-y-2">
                {stats.byItem.map((entry) => (
                  <div key={`${entry.name}-${entry.item_id ?? 'na'}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#2e1d14]/45 px-3 py-2">
                    <div className="h-9 w-9 overflow-hidden rounded-lg bg-[#23140e]">
                      {entry.image_url ? <Image src={entry.image_url} alt={entry.name} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#efcdab]">📦</div>}
                    </div>
                    <p className="flex-1 text-sm text-[#ffe8ca]">{entry.name}</p>
                    <p className="rounded-lg border border-white/10 bg-[#5a2f2f]/50 px-2 py-1 text-xs text-[#ffd6d6]">Acheté: {entry.bought}</p>
                    <p className="rounded-lg border border-white/10 bg-[#2d4a34]/50 px-2 py-1 text-xs text-[#d4ffd8]">Vendu: {entry.sold}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'messages' && canViewMessages ? <section className="glass-card p-5 space-y-3"><h3 className="text-base font-semibold text-[#fff1dd]">Messages prédéfinis</h3>{canManageMessages ? <div className="grid gap-2 md:grid-cols-4"><input className="saas-input" placeholder="Titre" value={messageDraft.title} onChange={(e) => setMessageDraft((c) => ({ ...c, title: e.target.value }))} /><input className="saas-input md:col-span-2" placeholder="Message" value={messageDraft.content} onChange={(e) => setMessageDraft((c) => ({ ...c, content: e.target.value }))} /><button className="saas-primary-btn" onClick={() => void saveMessage()}>{messageDraft.id ? 'Modifier' : 'Ajouter'}</button></div> : null}<div className="space-y-2">{messages.map((m) => <div key={m.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><div className="flex items-center justify-between"><p className="font-medium text-[#ffe8ca]">{m.title}</p><button className="saas-ghost-btn !px-2" onClick={() => void navigator.clipboard.writeText(m.content)}>Copier</button></div><p className="mt-1 text-sm text-[#efcdab]">{m.content}</p></div>)}</div></section> : null}

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}

function SummaryLine({ label, value, positive, danger }: { label: string; value: string; positive?: boolean; danger?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2"><p className="text-xs text-[#efcdab]">{label}</p><p className={`text-sm font-semibold ${positive ? 'text-[#bff0b9]' : danger ? 'text-[#f0b9b9]' : 'text-[#ffe8ca]'}`}>{value}</p></div>;
}
