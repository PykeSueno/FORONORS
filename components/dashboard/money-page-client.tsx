'use client';

import { FormEvent, useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { humanMoneyMovementLabel } from '@/lib/labels';

type Movement = {
  id: number;
  type: string;
  amount: number;
  label: string;
  created_at: string;
  user_id: string | null;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
  before_amount?: number | null;
  after_amount?: number | null;
};

function moneyMovementIcon(type: string) {
  if (type === 'entry') return 'entry';
  if (type === 'exit') return 'exit';
  if (type === 'adjust') return 'edit';
  if (type === 'sale') return 'sale';
  if (type === 'purchase') return 'purchase';
  if (type === 'payment') return 'payment';
  if (type === 'laundering') return 'laundering';
  if (type === 'tablet_passage' || type === 'tablet_morning_deposit') return 'tablet';
  if (type === 'four_close') return 'four';
  if (type.startsWith('drugs_')) return 'drugs';
  return 'cash';
}

type MoneyIconName = 'cash' | 'edit' | 'add' | 'entry' | 'exit' | 'purchase' | 'sale' | 'payment' | 'laundering' | 'history' | 'beforeAfter' | 'tablet' | 'four' | 'drugs';

function MoneyIcon({ name, className = 'h-4 w-4' }: { name: MoneyIconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} ${moneyIconColor(name)}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {moneyIconShape(name)}
    </svg>
  );
}

function moneyIconColor(name: MoneyIconName) {
  if (name === 'entry') return 'text-emerald-300';
  if (name === 'exit') return 'text-red-300';
  if (name === 'purchase' || name === 'sale') return 'text-amber-300';
  if (name === 'laundering') return 'text-sky-300';
  if (name === 'history' || name === 'beforeAfter') return 'text-[#f6d6b3]';
  return 'text-[#ffe2b8]';
}

function moneyIconShape(name: MoneyIconName) {
  switch (name) {
    case 'cash': return <><path d="M4 7h16v10H4z" /><circle cx="12" cy="12" r="2.5" /><path d="M7 12h.01" /><path d="M17 12h.01" /></>;
    case 'edit': return <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 7.5l3 3" /></>;
    case 'add': return <><circle cx="12" cy="12" r="8" /><path d="M12 8v8" /><path d="M8 12h8" /></>;
    case 'entry': return <><path d="M12 3v14" /><path d="m7 12 5 5 5-5" /><path d="M5 21h14" /></>;
    case 'exit': return <><path d="M12 21V7" /><path d="m7 12 5-5 5 5" /><path d="M5 3h14" /></>;
    case 'purchase': return <><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /><path d="M3 4h2l2.5 11h10L20 7H7" /></>;
    case 'sale': return <><path d="M20 12 12 20 4 12V4h8z" /><path d="M8 8h.01" /></>;
    case 'payment': return <><path d="M4 7h16v10H4z" /><path d="M8 11h.01" /><path d="M16 13h.01" /><circle cx="12" cy="12" r="2" /></>;
    case 'laundering': return <><path d="M4 10h16" /><path d="M6 10V8l6-4 6 4v2" /><path d="M7 10v8" /><path d="M12 10v8" /><path d="M17 10v8" /><path d="M4 20h16" /></>;
    case 'history': return <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></>;
    case 'beforeAfter': return <><path d="M7 7h10" /><path d="m14 4 3 3-3 3" /><path d="M17 17H7" /><path d="m10 14-3 3 3 3" /></>;
    case 'tablet': return <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17h2" /></>;
    case 'four': return <><path d="M12 21c4-2 6-5 6-8 0-3-2-5-4-7 0 3-2 4-2 4s-2-2-1-6c-3 2-5 5-5 9 0 3 2 6 6 8z" /></>;
    case 'drugs': return <><path d="M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" /><path d="M8 3h8" /><path d="M8 15h8" /></>;
  }
}

export function MoneyPageClient({
  canEdit,
  initialBalance,
  initialMovements
}: {
  canEdit: boolean;
  initialBalance: number;
  initialMovements: Movement[];
}) {
  const [balance, setBalance] = useState(String(initialBalance));
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [type, setType] = useState('entry');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const latest = movements[0];
  const formattedBalance = useMemo(() => formatUsd(Number(balance || 0)), [balance]);

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextBalance = Number(balance);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) return setError('Montant invalide.');
    const response = await fetch('/api/money', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: nextBalance, label: 'Ajustement depuis page Argent' })
    });

    const payload = await response.json().catch(() => ({} as { message?: string; cash?: { balance: number }; movement?: Movement | null }));
    if (!response.ok) {
      setError(payload.message ?? 'Mise à jour impossible.');
      return;
    }

    setBalance(String(Number(payload.cash?.balance ?? balance)));
    if (payload.movement) setMovements((rows) => [payload.movement as Movement, ...rows]);
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const movementAmount = Number(amount);
    if (!Number.isFinite(movementAmount) || movementAmount <= 0) return setError('Montant invalide.');
    const response = await fetch('/api/money/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: movementAmount, label: type === 'laundering' ? (label.trim() || 'Blanchiment — ajout banque') : label })
    });

    const payload = await response.json().catch(() => ({} as { message?: string; cash?: { balance: number }; movement?: Movement }));
    if (!response.ok) {
      setError(payload.message ?? 'Création mouvement impossible.');
      return;
    }

    setBalance(String(Number(payload.cash?.balance ?? balance)));
    if (payload.movement) setMovements((rows) => [payload.movement as Movement, ...rows]);
    setAmount('');
    setLabel('');
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#fff2de]"><MoneyIcon name="cash" className="h-6 w-6" />Argent</h1>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-[#efcdab]"><MoneyIcon name="cash" />Caisse actuelle</p>
            <p className="mt-2 text-3xl font-bold text-[#ffe5c0]">{formattedBalance}</p>
            {latest ? <p className="mt-2 text-sm text-[#ffe3c3]">Dernière activité: {humanMoneyMovementLabel(latest.type)} · {formatUsd(Number(latest.amount))} · {latest.label}</p> : null}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {canEdit ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={saveBalance} className="glass-card space-y-3 p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#fff1db]"><MoneyIcon name="edit" />Modifier le montant</h2>
            <input className="saas-input w-full" value={balance} onChange={(e) => setBalance(e.target.value)} />
            <button className="saas-primary-btn inline-flex items-center gap-2" type="submit"><MoneyIcon name="edit" />Enregistrer le montant</button>
          </form>

          <form onSubmit={addMovement} className="glass-card space-y-3 p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#fff1db]"><MoneyIcon name="add" />Ajouter un mouvement</h2>
            <select className="saas-input w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="entry">Entrée</option>
              <option value="exit">Sortie</option>
              <option value="purchase">Achat</option>
              <option value="sale">Vente</option>
              <option value="payment">Paiement</option>
              <option value="laundering">Blanchiment</option>
            </select>
            <p className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#2f1d14]/55 px-3 py-2 text-xs text-[#efcdab]">
              <MoneyIcon name={moneyMovementIcon(type) as MoneyIconName} />
              Type sélectionné : {humanMoneyMovementLabel(type)}
            </p>
            <input className="saas-input w-full" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <input className="saas-input w-full" placeholder={type === 'laundering' ? 'Blanchiment — ajout banque' : 'Libellé'} value={label} onChange={(e) => setLabel(e.target.value)} required={type !== 'laundering'} />
            <button className="saas-primary-btn inline-flex items-center gap-2" type="submit"><MoneyIcon name="add" />Ajouter</button>
          </form>
        </section>
      ) : null}

      <section className="glass-card p-5">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#fff1db]"><MoneyIcon name="history" />Historique</h2>
        <div className="mt-3 space-y-2">
          {movements.map((movement) => (
            <div key={movement.id} className="rounded-xl border border-white/10 bg-[#5a3924]/55 px-3 py-2 text-sm text-[#ffe4c6]">
              <p className="inline-flex items-center gap-2"><MoneyIcon name={moneyMovementIcon(movement.type) as MoneyIconName} />{Array.isArray(movement.users) ? (movement.users[0]?.name || movement.users[0]?.username) : (movement.users?.name || movement.users?.username) || 'Groupe'} — {humanMoneyMovementLabel(movement.type)} — {movement.label}</p>
              {movement.before_amount != null && movement.after_amount != null ? <MoneyBeforeAfter movement={movement} /> : null}
              <p className="text-xs text-[#efcdab]">{new Date(movement.created_at).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MoneyBeforeAfter({ movement }: { movement: Movement }) {
  const amount = Number(movement.amount ?? 0);
  const movementLabel = movement.type === 'laundering' ? 'Blanchiment' : 'Mouvement';
  return (
    <p className="text-xs text-[#efcdab]">
      <span className="inline-flex items-center gap-1"><MoneyIcon name="beforeAfter" className="h-3.5 w-3.5" />Avant : {formatUsd(Number(movement.before_amount ?? 0))} · {movementLabel} : {amount >= 0 ? '+' : ''}{formatUsd(amount)} · Après : {formatUsd(Number(movement.after_amount ?? 0))}</span>
    </p>
  );
}
