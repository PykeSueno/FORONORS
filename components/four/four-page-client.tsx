'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { ITEM_CATEGORIES } from '@/lib/items';

type Member = { id: string; name: string; username: string };
type Item = { id: number; name: string; image_url: string | null; quantity: number; buy_price?: number; sell_price?: number; category_key?: string | null };
type LineKind = 'buy' | 'sell';

type FourLine = { id?: number; item_id: number; item_name: string; movement_kind: LineKind; quantity: number; unit_price: number; total_amount: number };
type FourTx = { id: number; counterparty: string | null; total_purchases: number; total_sales: number; profit_loss: number; created_at: string; four_transaction_lines: FourLine[] };
type FourSession = { id: number; status: 'open' | 'closed'; opened_at: string; summary?: Record<string, unknown> | null; four_transactions: FourTx[] };
type FourHistory = { id: number; closed_at: string | null; summary?: Record<string, unknown> | null };
type FourMessage = { id: number; title: string; content: string; display_order: number };
type FourStats = {
  totals: { sessions: number; purchases: number; sales: number; profit: number };
  byMember: Record<string, { sessions: number; profit: number }>;
  byCounterparty: Record<string, { purchases: number; sales: number; count: number }>;
  sessions: Array<{ id: number; opened_at: string; closed_at: string | null }>;
};

export function FourPageClient({ members, items, activeSession, history, canOpen, canCashAdd, canManageTransaction, canValidateTransaction, canClose, canViewHistory, canViewStats, canViewMessages, canManageMessages, currentUserId }: {
  members: Member[];
  items: Item[];
  activeSession: FourSession | null;
  history: FourHistory[];
  canOpen: boolean;
  canCashAdd: boolean;
  canManageTransaction: boolean;
  canValidateTransaction: boolean;
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
  const [messages, setMessages] = useState<FourMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState({ id: 0, title: '', content: '', display_order: 100 });

  const filteredItems = useMemo(() => items.filter((item) => {
    const qOk = !query || item.name.toLowerCase().includes(query.toLowerCase());
    const cOk = !categoryFilter || item.category_key === categoryFilter;
    return qOk && cOk;
  }), [items, query, categoryFilter]);

  const validatedTotals = useMemo(() => {
    const txs = session?.four_transactions ?? [];
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

  async function reload() {
    const response = await fetch('/api/four', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setSession(data.active);
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
    await reload();
  }

  async function addCash() {
    if (!session?.id || cashAddAmount <= 0) return;
    const response = await fetch('/api/four/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, amount: cashAddAmount })
    });
    if (!response.ok) return setError((await response.json()).message ?? 'Ajout cash impossible.');
    setCashAddAmount(0);
    await reload();
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
    if (!session?.id || draftLines.length === 0) return;
    const response = await fetch('/api/four/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, counterparty, lines: draftLines.map((line) => ({ item_id: line.item_id, movement_kind: line.movement_kind, quantity: line.quantity, unit_price: line.unit_price })) })
    });
    if (!response.ok) return setError((await response.json()).message ?? 'Validation impossible.');
    setDraftLines([]);
    setCounterparty('');
    await reload();
  }

  async function closeSession() {
    if (!session?.id) return;
    const response = await fetch('/api/four', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: session.id }) });
    if (!response.ok) return setError((await response.json()).message ?? 'Clôture impossible.');
    setSession(null);
    setDraftLines([]);
  }

  async function loadStats() { const res = await fetch('/api/four/stats', { cache: 'no-store' }); if (res.ok) setStats(await res.json()); }
  async function loadMessages() { const res = await fetch('/api/four/messages', { cache: 'no-store' }); if (res.ok) setMessages((await res.json()).messages ?? []); }
  async function saveMessage() { const res = await fetch('/api/four/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: messageDraft.id || undefined, title: messageDraft.title, content: messageDraft.content, display_order: messageDraft.display_order }) }); if (res.ok) { setMessageDraft({ id: 0, title: '', content: '', display_order: 100 }); await loadMessages(); } }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#fff1dd]">FOUR</h3>
        <div className="flex gap-2">
          <button className={`filter-pill ${activeTab === 'session' ? 'filter-pill-active' : ''}`} onClick={() => setActiveTab('session')}>Session</button>
          {canViewStats ? <button className={`filter-pill ${activeTab === 'stats' ? 'filter-pill-active' : ''}`} onClick={() => { setActiveTab('stats'); void loadStats(); }}>Stats</button> : null}
          {canViewMessages ? <button className={`filter-pill ${activeTab === 'messages' ? 'filter-pill-active' : ''}`} onClick={() => { setActiveTab('messages'); void loadMessages(); }}>Messages</button> : null}
        </div>
      </section>

      {activeTab === 'session' ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <article className="space-y-4">
            <section className="glass-card p-5">
              <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-[#fff1dd]">Session FOUR</h3><span className={`rounded-full px-3 py-1 text-xs ${session ? 'bg-[#83d89f]/20 text-[#c7f5d8]' : 'bg-[#e08f8f]/20 text-[#ffd4d4]'}`}>{session ? 'Ouverte' : 'Fermée'}</span></div>
              {!session && canOpen ? (
                <div className="mt-3 space-y-2">
                  <select className="saas-input w-full" value={openingMemberId} onChange={(e) => setOpeningMemberId(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name || m.username}</option>)}</select>
                  <input className="saas-input w-full" value={initialCash} onChange={(e) => setInitialCash(Math.max(0, Number(e.target.value || 0)))} placeholder="Cash initial" />
                  <button className="saas-primary-btn w-full" onClick={() => void openSession()}>Ouvrir le FOUR</button>
                </div>
              ) : null}
              {session && canCashAdd ? (
                <div className="mt-3 flex gap-2">
                  <input className="saas-input flex-1" value={cashAddAmount} onChange={(e) => setCashAddAmount(Math.max(0, Number(e.target.value || 0)))} placeholder="Ajouter du cash" />
                  <button className="saas-ghost-btn" onClick={() => void addCash()}>Ajouter cash</button>
                </div>
              ) : null}
            </section>

            <section className="glass-card p-5 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <button className={`filter-pill w-full ${draftKind === 'buy' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('buy')}>Achat par défaut</button>
                <button className={`filter-pill w-full ${draftKind === 'sell' ? 'filter-pill-active' : ''}`} onClick={() => setDraftKind('sell')}>Vente par défaut</button>
              </div>
              <input className="saas-input w-full" placeholder="Recherche item" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="saas-input w-full" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Toutes catégories</option>
                {ITEM_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {filteredItems.map((item) => (
                  <button key={item.id} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#2e1d14]/65 px-3 py-2 text-left" disabled={!session || !canManageTransaction} onClick={() => addItemToDraft(item)}>
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#23140e]">{item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}</div>
                    <div><p className="text-sm text-[#ffe8ca]">{item.name}</p><p className="text-xs text-[#efcdab]">{ITEM_CATEGORIES.find((entry) => entry.key === item.category_key)?.label ?? item.category_key ?? 'Catégorie'} · Stock {item.quantity}</p></div>
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-card p-5 space-y-2">
              <h3 className="text-base font-semibold text-[#fff1dd]">Résumé en direct</h3>
              <SummaryLine label="Cash départ" value={formatUsd(summary.initial)} />
              <SummaryLine label="Cash ajouté" value={formatUsd(summary.added)} />
              <SummaryLine label="Achats validés" value={formatUsd(summary.purchases)} danger />
              <SummaryLine label="Ventes validées" value={formatUsd(summary.sales)} positive />
              <SummaryLine label="Résultat provisoire" value={formatUsd(summary.profit)} positive={summary.profit >= 0} danger={summary.profit < 0} />
              <SummaryLine label="Cash session" value={formatUsd(summary.cash)} />
            </section>
          </article>

          <article className="glass-card p-5 space-y-3">
            <h3 className="text-base font-semibold text-[#fff1dd]">Transaction en cours</h3>
            <input className="saas-input w-full" placeholder="Interlocuteur / client / groupe" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            <div className="space-y-2">
              {draftLines.map((line, index) => {
                const item = items.find((entry) => entry.id === line.item_id);
                return (
                  <div key={`${line.item_id}-${index}`} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-[#23140e]">{item?.image_url ? <Image src={item.image_url} alt={line.item_name} width={48} height={48} className="h-full w-full object-cover" unoptimized /> : null}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#ffe8ca]">{line.item_name}</p>
                        <p className="text-xs text-[#efcdab]">📦 Stock actuel : {item?.quantity ?? 0}</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-5">
                          <select className="saas-input" value={line.movement_kind} onChange={(e) => updateDraftLine(index, { movement_kind: e.target.value as LineKind })}><option value="buy">Achat</option><option value="sell">Vente</option></select>
                          <div className="flex items-center gap-1"><button className="saas-ghost-btn !px-2" onClick={() => updateDraftLine(index, { quantity: Math.max(1, line.quantity - 1) })}>-</button><input className="saas-input text-center" value={line.quantity} onChange={(e) => updateDraftLine(index, { quantity: Math.max(1, Number(e.target.value || 1)) })} /><button className="saas-ghost-btn !px-2" onClick={() => updateDraftLine(index, { quantity: line.quantity + 1 })}>+</button></div>
                          <input className="saas-input" value={line.unit_price} onChange={(e) => updateDraftLine(index, { unit_price: Math.max(0, Number(e.target.value || 0)) })} />
                          <p className="saas-input md:col-span-2">{formatUsd(line.quantity * line.unit_price)}</p>
                        </div>
                      </div>
                      <button className="saas-ghost-btn !px-2" onClick={() => removeDraftLine(index)}>🗑️</button>
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

            {canValidateTransaction ? <button className="saas-primary-btn w-full" onClick={() => void validateTransaction()}>Valider la transaction</button> : null}
            {canClose && session ? <button className="saas-ghost-btn w-full" onClick={() => void closeSession()}>Fermer le FOUR</button> : null}

            <div className="rounded-xl border border-white/10 bg-[#2e1d14]/45 p-3">
              <p className="text-sm font-semibold text-[#fff1dd]">Transactions validées ({session?.four_transactions?.length ?? 0})</p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {(session?.four_transactions ?? []).map((tx) => <p key={tx.id} className="text-xs text-[#efcdab]">#{tx.id} · {tx.counterparty || '—'} · +{formatUsd(Number(tx.total_sales))} / -{formatUsd(Number(tx.total_purchases))}</p>)}
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'stats' && canViewStats ? <section className="glass-card p-5 space-y-3"><h3 className="text-base font-semibold text-[#fff1dd]">Stats FOUR</h3>{stats ? <pre className="overflow-auto text-xs text-[#efcdab]">{JSON.stringify(stats, null, 2)}</pre> : <button className="saas-primary-btn" onClick={() => void loadStats()}>Charger les stats</button>}</section> : null}
      {activeTab === 'messages' && canViewMessages ? <section className="glass-card p-5 space-y-3"><h3 className="text-base font-semibold text-[#fff1dd]">Messages prédéfinis</h3>{canManageMessages ? <div className="grid gap-2 md:grid-cols-4"><input className="saas-input" placeholder="Titre" value={messageDraft.title} onChange={(e) => setMessageDraft((c) => ({ ...c, title: e.target.value }))} /><input className="saas-input md:col-span-2" placeholder="Message" value={messageDraft.content} onChange={(e) => setMessageDraft((c) => ({ ...c, content: e.target.value }))} /><button className="saas-primary-btn" onClick={() => void saveMessage()}>{messageDraft.id ? 'Modifier' : 'Ajouter'}</button></div> : null}<div className="space-y-2">{messages.map((m) => <div key={m.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><div className="flex items-center justify-between"><p className="font-medium text-[#ffe8ca]">{m.title}</p><button className="saas-ghost-btn !px-2" onClick={() => void navigator.clipboard.writeText(m.content)}>Copier</button></div><p className="mt-1 text-sm text-[#efcdab]">{m.content}</p></div>)}</div></section> : null}

      {canViewHistory ? <section className="glass-card p-5"><h3 className="text-base font-semibold text-[#fff1dd]">Historique FOUR</h3><div className="mt-2 space-y-1">{history.map((entry) => <p key={entry.id} className="text-sm text-[#efcdab]">Session #{entry.id} · fermée {entry.closed_at ? new Date(entry.closed_at).toLocaleString('fr-FR') : '-'}</p>)}</div></section> : null}
      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}

function SummaryLine({ label, value, positive, danger }: { label: string; value: string; positive?: boolean; danger?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2"><p className="text-xs text-[#efcdab]">{label}</p><p className={`text-sm font-semibold ${positive ? 'text-[#bff0b9]' : danger ? 'text-[#f0b9b9]' : 'text-[#ffe8ca]'}`}>{value}</p></div>;
}
