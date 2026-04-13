'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';

type Member = { id: string; name: string; username: string };
type Item = { id: number; name: string; image_url: string | null; quantity: number };
type MovementKind = 'cash_out' | 'cash_in' | 'item_out' | 'item_in' | 'buy' | 'sell';

export function FourPageClient({ members, items, activeSession, history, canOpen, canManage, canClose, canViewHistory, currentUserId }: { members: Member[]; items: Item[]; activeSession: any; history: any[]; canOpen: boolean; canManage: boolean; canClose: boolean; canViewHistory: boolean; currentUserId: string; }) {
  const [session, setSession] = useState<any>(activeSession);
  const [error, setError] = useState('');
  const [openingMemberId, setOpeningMemberId] = useState(currentUserId);
  const [kind, setKind] = useState<MovementKind>('cash_out');
  const [itemId, setItemId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [note, setNote] = useState('');

  const summary = useMemo(() => {
    const rows = (session?.four_movements ?? []) as any[];
    let cash = 0;
    for (const m of rows) {
      const qty = Number(m.quantity ?? 0);
      const total = Number(m.total_amount ?? 0);
      if (m.movement_kind === 'cash_out') cash -= total || qty;
      if (m.movement_kind === 'cash_in') cash += total || qty;
      if (m.movement_kind === 'buy') cash -= total;
      if (m.movement_kind === 'sell') cash += total;
    }
    return { cash, rows };
  }, [session]);

  async function reload() {
    const response = await fetch('/api/four', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { active: any };
    setSession(data.active);
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

  async function addMovement() {
    if (!session?.id) return;
    setError('');
    const response = await fetch('/api/four/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, movement_kind: kind, item_id: itemId || null, quantity, unit_price: unitPrice, note })
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Mouvement FOUR impossible.');
      return;
    }
    setNote('');
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

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#fff1dd]">État session FOUR</h3>
          <span className={`rounded-full px-3 py-1 text-xs ${session ? 'bg-[#83d89f]/20 text-[#c7f5d8]' : 'bg-[#e08f8f]/20 text-[#ffd4d4]'}`}>{session ? 'FOUR en cours' : 'FOUR fermé'}</span>
        </div>
        {session ? (
          <div className="mt-3 grid gap-2 md:grid-cols-3 text-sm text-[#f3d5b4]">
            <p>Session #{session.id}</p>
            <p>Ouverture: {new Date(session.opened_at).toLocaleString('fr-FR')}</p>
            <p>Cash session: <span className="font-semibold text-[#ffe9cd]">{formatUsd(summary.cash)}</span></p>
          </div>
        ) : canOpen ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select className="saas-input" value={openingMemberId} onChange={(e) => setOpeningMemberId(e.target.value)}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
            </select>
            <button className="saas-primary-btn" onClick={() => void openSession()}>Ouvrir le FOUR</button>
          </div>
        ) : null}
      </section>

      {session && canManage ? (
        <section className="glass-card p-5 space-y-3">
          <h3 className="text-base font-semibold text-[#fff1dd]">Mouvements session</h3>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <select className="saas-input" value={kind} onChange={(e) => setKind(e.target.value as MovementKind)}>
              <option value="cash_out">Sortie cash</option>
              <option value="cash_in">Entrée cash</option>
              <option value="item_out">Sortie item</option>
              <option value="item_in">Entrée item</option>
              <option value="buy">Achat</option>
              <option value="sell">Vente</option>
            </select>
            <select className="saas-input" value={itemId} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Aucun item</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input className="saas-input" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))} />
            <input className="saas-input" value={unitPrice} onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value || 0)))} />
            <input className="saas-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
            <button className="saas-primary-btn" onClick={() => void addMovement()}>Ajouter</button>
          </div>

          <div className="space-y-2">
            {summary.rows.map((row) => {
              const item = items.find((entry) => entry.id === row.item_id);
              return (
                <div key={row.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 px-3 py-2 flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#23140e]">{item?.image_url ? <Image src={item.image_url} alt={item.name} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : null}</div>
                  <p className="text-sm text-[#ffe8ca] flex-1">{row.movement_kind} · {row.item_name ?? 'Cash'} · Qté {row.quantity}</p>
                  <p className="text-xs text-[#efcdab]">{formatUsd(Number(row.total_amount ?? 0))}</p>
                </div>
              );
            })}
          </div>

          {canClose ? <button className="saas-ghost-btn" onClick={() => void closeSession()}>Clôturer la session FOUR</button> : null}
        </section>
      ) : null}

      {canViewHistory ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique FOUR</h3>
          <div className="mt-2 space-y-2">
            {history.map((entry) => <p key={entry.id} className="text-sm text-[#f3d5b4]">Session #{entry.id} · fermée {entry.closed_at ? new Date(entry.closed_at).toLocaleString('fr-FR') : '-'}</p>)}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}
