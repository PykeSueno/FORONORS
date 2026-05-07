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
  if (type === 'entry') return '💵';
  if (type === 'exit') return '💸';
  if (type === 'adjust') return '🧮';
  if (type === 'sale') return '🛒';
  if (type === 'purchase') return '🧾';
  if (type === 'payment') return '🧑‍💼';
  if (type === 'laundering') return '🏦';
  if (type === 'tablet_passage' || type === 'tablet_morning_deposit') return '📱';
  if (type === 'four_close') return '🔥';
  if (type.startsWith('drugs_')) return '🧪';
  return '💰';
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
            <h1 className="text-2xl font-semibold text-[#fff2de]">Argent</h1>
            <p className="mt-2 text-3xl font-bold text-[#ffe5c0]">{formattedBalance}</p>
            {latest ? <p className="mt-2 text-sm text-[#ffe3c3]">Dernière activité: {humanMoneyMovementLabel(latest.type)} · {formatUsd(Number(latest.amount))} · {latest.label}</p> : null}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {canEdit ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={saveBalance} className="glass-card space-y-3 p-5">
            <h2 className="text-lg font-semibold text-[#fff1db]">Modifier le montant</h2>
            <input className="saas-input w-full" value={balance} onChange={(e) => setBalance(e.target.value)} />
            <button className="saas-primary-btn" type="submit">Enregistrer le montant</button>
          </form>

          <form onSubmit={addMovement} className="glass-card space-y-3 p-5">
            <h2 className="text-lg font-semibold text-[#fff1db]">Ajouter un mouvement</h2>
            <select className="saas-input w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="entry">Entrée</option>
              <option value="exit">Sortie</option>
              <option value="purchase">Achat</option>
              <option value="sale">Vente</option>
              <option value="payment">Paiement</option>
              <option value="laundering">Blanchiment</option>
            </select>
            <input className="saas-input w-full" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <input className="saas-input w-full" placeholder={type === 'laundering' ? 'Blanchiment — ajout banque' : 'Libellé'} value={label} onChange={(e) => setLabel(e.target.value)} required={type !== 'laundering'} />
            <button className="saas-primary-btn" type="submit">Ajouter</button>
          </form>
        </section>
      ) : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1db]">Historique</h2>
        <div className="mt-3 space-y-2">
          {movements.map((movement) => (
            <div key={movement.id} className="rounded-xl border border-white/10 bg-[#5a3924]/55 px-3 py-2 text-sm text-[#ffe4c6]">
              <p>{moneyMovementIcon(movement.type)} {Array.isArray(movement.users) ? (movement.users[0]?.name || movement.users[0]?.username) : (movement.users?.name || movement.users?.username) || 'Groupe'} — {humanMoneyMovementLabel(movement.type)} — {movement.label}</p>
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
      Avant : {formatUsd(Number(movement.before_amount ?? 0))} · {movementLabel} : {amount >= 0 ? '+' : ''}{formatUsd(amount)} · Après : {formatUsd(Number(movement.after_amount ?? 0))}
    </p>
  );
}
