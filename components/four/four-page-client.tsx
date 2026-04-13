'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';

type Member = { id: string; name: string; username: string };
type Item = { id: number; name: string; image_url: string | null; quantity: number; buy_price?: number; sell_price?: number };
type MovementKind = 'cash_out' | 'cash_in' | 'item_out' | 'item_in' | 'buy' | 'sell';

type FourMovement = {
  id: number;
  movement_kind: MovementKind;
  item_id: number | null;
  item_name: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  note: string | null;
  counterparty: string | null;
  created_at: string;
};

type FourSession = {
  id: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  four_movements: FourMovement[];
};

type FourHistoryEntry = { id: number; closed_at: string | null };
type FourMessage = { id: number; title: string; content: string; display_order: number };

const KIND_LABEL: Record<MovementKind, string> = {
  cash_out: 'Sortie cash',
  cash_in: 'Entrée cash',
  item_out: 'Sortie item',
  item_in: 'Entrée item',
  buy: 'Achat',
  sell: 'Vente'
};

export function FourPageClient({
  members,
  items,
  activeSession,
  history,
  canOpen,
  canManage,
  canClose,
  canViewHistory,
  canViewStats,
  canViewMessages,
  canManageMessages,
  currentUserId
}: {
  members: Member[];
  items: Item[];
  activeSession: FourSession | null;
  history: FourHistoryEntry[];
  canOpen: boolean;
  canManage: boolean;
  canClose: boolean;
  canViewHistory: boolean;
  canViewStats: boolean;
  canViewMessages: boolean;
  canManageMessages: boolean;
  currentUserId: string;
}) {
  const [session, setSession] = useState<FourSession | null>(activeSession);
  const [error, setError] = useState('');
  const [openingMemberId, setOpeningMemberId] = useState(currentUserId);
  const [kind, setKind] = useState<MovementKind>('cash_out');
  const [itemId, setItemId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [note, setNote] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'session' | 'stats' | 'messages'>('session');
  const [stats, setStats] = useState<{ totals: { sessions: number; sales: number; purchases: number; profit: number }; counterpartyTotals: Record<string, { sales: number; purchases: number }>; itemSold: Record<string, number> } | null>(null);
  const [messages, setMessages] = useState<FourMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState({ id: 0, title: '', content: '', display_order: 100 });

  const summary = useMemo(() => {
    const rows = session?.four_movements ?? [];
    let cashOut = 0;
    let cashIn = 0;
    let purchases = 0;
    let sales = 0;
    const stock: Record<string, number> = {};

    for (const movement of rows) {
      const qty = Number(movement.quantity || 0);
      const total = Number(movement.total_amount || 0);
      if (movement.movement_kind === 'cash_out') cashOut += total || qty;
      if (movement.movement_kind === 'cash_in') cashIn += total || qty;
      if (movement.movement_kind === 'buy') purchases += total;
      if (movement.movement_kind === 'sell') sales += total;

      if (movement.item_name) {
        const current = stock[movement.item_name] ?? 0;
        if (movement.movement_kind === 'item_in' || movement.movement_kind === 'buy') stock[movement.item_name] = current + qty;
        if (movement.movement_kind === 'item_out' || movement.movement_kind === 'sell') stock[movement.item_name] = current - qty;
      }
    }

    const cashSession = cashIn + sales - cashOut - purchases;
    return { rows, cashOut, cashIn, purchases, sales, cashSession, profit: sales - purchases, stock };
  }, [session]);

  async function reload() {
    const response = await fetch('/api/four', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { active: FourSession | null };
    setSession(data.active);
  }

  function applyAutoPrice(nextKind: MovementKind, nextItemId: number | '') {
    if (!nextItemId) return;
    const selected = items.find((item) => item.id === nextItemId);
    if (!selected) return;
    if (nextKind === 'buy') setUnitPrice(Number(selected.buy_price ?? 0));
    if (nextKind === 'sell') setUnitPrice(Number(selected.sell_price ?? 0));
  }

  async function openSession() {
    setError('');
    const response = await fetch('/api/four', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managed_by: openingMemberId })
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Ouverture FOUR impossible.');
      return;
    }
    await reload();
  }

  async function saveMovement() {
    if (!session?.id) return;
    setError('');
    const endpoint = '/api/four/movements';
    const method = editingMovementId ? 'PATCH' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movement_id: editingMovementId ?? undefined, session_id: session.id, movement_kind: kind, item_id: itemId || null, quantity, unit_price: unitPrice, note, counterparty })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Mouvement FOUR impossible.');
      return;
    }

    setNote('');
    setCounterparty('');
    setEditingMovementId(null);
    await reload();
  }

  async function deleteMovement(movementId: number) {
    const response = await fetch(`/api/four/movements?movement_id=${movementId}`, { method: 'DELETE' });
    if (!response.ok) return;
    await reload();
  }

  async function closeSession() {
    if (!session?.id) return;
    const response = await fetch('/api/four', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: session.id }) });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Clôture FOUR impossible.');
      return;
    }
    setSession(null);
  }

  async function loadStats() {
    const response = await fetch('/api/four/stats', { cache: 'no-store' });
    if (!response.ok) return;
    setStats(await response.json());
  }

  async function loadMessages() {
    const response = await fetch('/api/four/messages', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { messages: FourMessage[] };
    setMessages(data.messages);
  }

  async function saveMessage() {
    const response = await fetch('/api/four/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageDraft.id || undefined, title: messageDraft.title, content: messageDraft.content, display_order: messageDraft.display_order })
    });
    if (!response.ok) return;
    setMessageDraft({ id: 0, title: '', content: '', display_order: 100 });
    await loadMessages();
  }

  async function deleteMessage(id: number) {
    await fetch('/api/four/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    await loadMessages();
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-[#fff1dd]">FOUR</h3>
          <div className="flex gap-2">
            <button className={`filter-pill ${activeTab === 'session' ? 'filter-pill-active' : ''}`} onClick={() => setActiveTab('session')}>Session</button>
            {canViewStats ? <button className={`filter-pill ${activeTab === 'stats' ? 'filter-pill-active' : ''}`} onClick={() => { setActiveTab('stats'); void loadStats(); }}>Stats</button> : null}
            {canViewMessages ? <button className={`filter-pill ${activeTab === 'messages' ? 'filter-pill-active' : ''}`} onClick={() => { setActiveTab('messages'); void loadMessages(); }}>Messages</button> : null}
          </div>
        </div>
      </section>

      {activeTab === 'session' ? (
        <>
          <section className="glass-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#fff1dd]">A. État session</h3>
              <span className={`rounded-full px-3 py-1 text-xs ${session ? 'bg-[#83d89f]/20 text-[#c7f5d8]' : 'bg-[#e08f8f]/20 text-[#ffd4d4]'}`}>{session ? 'FOUR en cours' : 'FOUR fermé'}</span>
            </div>
            {session ? <p className="mt-2 text-sm text-[#f3d5b4]">Session #{session.id} · ouverte {new Date(session.opened_at).toLocaleString('fr-FR')}</p> : null}
            {!session && canOpen ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className="saas-input" value={openingMemberId} onChange={(event) => setOpeningMemberId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}</select>
                <button className="saas-primary-btn" onClick={() => void openSession()}>Ouvrir le FOUR</button>
              </div>
            ) : null}
          </section>

          {session ? (
            <section className="grid gap-4 lg:grid-cols-3">
              <article className="glass-card p-5 lg:col-span-2 space-y-3">
                <h3 className="text-base font-semibold text-[#fff1dd]">B. Mouvements session</h3>
                {canManage ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="mb-1 text-xs text-[#efcdab]">Type de mouvement</p>
                    <select className="saas-input" value={kind} onChange={(event) => { const next = event.target.value as MovementKind; setKind(next); applyAutoPrice(next, itemId); }}>
                      {Object.entries(KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#efcdab]">Item</p>
                    <select className="saas-input" value={itemId} onChange={(event) => { const next = event.target.value ? Number(event.target.value) : ''; setItemId(next); applyAutoPrice(kind, next); }}>
                      <option value="">Aucun item</option>
                      {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#efcdab]">Quantité</p>
                    <input className="saas-input" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#efcdab]">Prix unitaire</p>
                    <input className="saas-input" value={unitPrice} onChange={(event) => setUnitPrice(Math.max(0, Number(event.target.value || 0)))} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#efcdab]">Interlocuteur / groupe</p>
                    <input className="saas-input" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <p className="mb-1 text-xs text-[#efcdab]">Note</p>
                    <input className="saas-input" value={note} onChange={(event) => setNote(event.target.value)} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#efcdab]">Total ligne</p>
                    <p className="saas-input">{formatUsd(quantity * unitPrice)}</p>
                  </div>
                  <div className="flex items-end"><button className="saas-primary-btn w-full" onClick={() => void saveMovement()}>{editingMovementId ? 'Modifier' : 'Ajouter'}</button></div>
                </div> : null}

                <div className="space-y-2">
                  {summary.rows.map((row) => {
                    const item = items.find((entry) => entry.id === row.item_id);
                    return (
                      <div key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#23140e]">{item?.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}</div>
                          <div className="flex-1">
                            <p className="text-sm text-[#ffe8ca]">{KIND_LABEL[row.movement_kind]} · {row.item_name ?? 'Cash'}</p>
                            <p className="text-xs text-[#efcdab]">Quantité: {row.quantity} · Prix unitaire: {formatUsd(row.unit_price)} · Total: {formatUsd(row.total_amount)}</p>
                            <p className="text-xs text-[#efcdab]">Interlocuteur: {row.counterparty || '—'} · Note: {row.note || '—'}</p>
                          </div>
                          {canManage ? <div className="flex gap-1"><button className="saas-ghost-btn !px-2" onClick={() => { setEditingMovementId(row.id); setKind(row.movement_kind); setItemId(row.item_id ?? ''); setQuantity(Number(row.quantity)); setUnitPrice(Number(row.unit_price)); setNote(row.note ?? ''); setCounterparty(row.counterparty ?? ''); }}>✏️</button><button className="saas-ghost-btn !px-2" onClick={() => void deleteMovement(row.id)}>🗑️</button></div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {canClose ? <button className="saas-ghost-btn" onClick={() => void closeSession()}>F. Clôturer la session FOUR</button> : null}
              </article>

              <article className="glass-card p-5 space-y-2">
                <h3 className="text-base font-semibold text-[#fff1dd]">E. Résumé en direct</h3>
                <SummaryLine label="Argent sorti" value={formatUsd(summary.cashOut)} danger />
                <SummaryLine label="Argent rentré" value={formatUsd(summary.cashIn + summary.sales)} positive />
                <SummaryLine label="Total achats" value={formatUsd(summary.purchases)} danger />
                <SummaryLine label="Total ventes" value={formatUsd(summary.sales)} positive />
                <SummaryLine label="Cash session" value={formatUsd(summary.cashSession)} positive={summary.cashSession >= 0} danger={summary.cashSession < 0} />
                <SummaryLine label="Bénéfice provisoire" value={formatUsd(summary.profit)} positive={summary.profit >= 0} danger={summary.profit < 0} />
                <div className="mt-3 rounded-xl border border-white/10 bg-[#2e1d14]/45 p-3">
                  <p className="text-xs text-[#efcdab]">Stock session restant</p>
                  {Object.entries(summary.stock).map(([name, qty]) => <p key={name} className="text-sm text-[#ffe8ca]">{name}: {qty}</p>)}
                </div>
              </article>
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === 'stats' && canViewStats ? (
        <section className="glass-card p-5 space-y-3">
          <h3 className="text-base font-semibold text-[#fff1dd]">Stats FOUR</h3>
          {stats ? (
            <>
              <div className="grid gap-2 md:grid-cols-4">
                <SummaryLine label="Sessions" value={String(stats.totals.sessions)} />
                <SummaryLine label="Ventes" value={formatUsd(stats.totals.sales)} positive />
                <SummaryLine label="Achats" value={formatUsd(stats.totals.purchases)} danger />
                <SummaryLine label="Bénéfice" value={formatUsd(stats.totals.profit)} positive={stats.totals.profit >= 0} danger={stats.totals.profit < 0} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                  <p className="text-sm font-semibold text-[#fff1dd]">Groupes / clients</p>
                  {Object.entries(stats.counterpartyTotals).map(([name, value]) => <p key={name} className="text-xs text-[#efcdab]">{name}: +{formatUsd(value.sales)} / -{formatUsd(value.purchases)}</p>)}
                </div>
                <div className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                  <p className="text-sm font-semibold text-[#fff1dd]">Items vendus</p>
                  {Object.entries(stats.itemSold).map(([name, qty]) => <p key={name} className="text-xs text-[#efcdab]">{name}: {qty}</p>)}
                </div>
              </div>
            </>
          ) : <button className="saas-primary-btn" onClick={() => void loadStats()}>Charger les stats</button>}
        </section>
      ) : null}

      {activeTab === 'messages' && canViewMessages ? (
        <section className="glass-card p-5 space-y-3">
          <h3 className="text-base font-semibold text-[#fff1dd]">Messages prédéfinis</h3>
          {canManageMessages ? (
            <div className="grid gap-2 md:grid-cols-4">
              <input className="saas-input" placeholder="Titre" value={messageDraft.title} onChange={(event) => setMessageDraft((current) => ({ ...current, title: event.target.value }))} />
              <input className="saas-input md:col-span-2" placeholder="Message" value={messageDraft.content} onChange={(event) => setMessageDraft((current) => ({ ...current, content: event.target.value }))} />
              <button className="saas-primary-btn" onClick={() => void saveMessage()}>{messageDraft.id ? 'Modifier' : 'Ajouter'}</button>
            </div>
          ) : null}
          <div className="space-y-2">
            {messages.map((message) => (
              <div key={message.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[#ffe8ca]">{message.title}</p>
                  <div className="flex gap-1">
                    <button className="saas-ghost-btn !px-2" onClick={() => void navigator.clipboard.writeText(message.content)}>Copier</button>
                    {canManageMessages ? <button className="saas-ghost-btn !px-2" onClick={() => setMessageDraft({ id: message.id, title: message.title, content: message.content, display_order: message.display_order })}>✏️</button> : null}
                    {canManageMessages ? <button className="saas-ghost-btn !px-2" onClick={() => void deleteMessage(message.id)}>🗑️</button> : null}
                  </div>
                </div>
                <p className="mt-1 text-sm text-[#efcdab]">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {canViewHistory ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique FOUR</h3>
          <div className="mt-2 space-y-2">{history.map((entry) => <p key={entry.id} className="text-sm text-[#f3d5b4]">Session #{entry.id} · fermée {entry.closed_at ? new Date(entry.closed_at).toLocaleString('fr-FR') : '-'}</p>)}</div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}

function SummaryLine({ label, value, positive, danger }: { label: string; value: string; positive?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
      <p className="text-xs text-[#efcdab]">{label}</p>
      <p className={`text-sm font-semibold ${positive ? 'text-[#bff0b9]' : danger ? 'text-[#f0b9b9]' : 'text-[#ffe8ca]'}`}>{value}</p>
    </div>
  );
}
