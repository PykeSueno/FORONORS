'use client';

import { FormEvent, useMemo, useState } from 'react';

type Movement = { id: number; type: string; amount: number; label: string; created_at: string };

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
  const [movements] = useState<Movement[]>(initialMovements);
  const [type, setType] = useState('entry');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const latest = movements[0];
  const formattedBalance = useMemo(() => Number(balance || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }), [balance]);

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/money', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: Number(balance), label: 'Ajustement depuis page Argent' })
    });

    if (!response.ok) {
      setError('Mise à jour impossible.');
      return;
    }

    window.location.reload();
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/money/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: Number(amount), label })
    });

    if (!response.ok) {
      setError('Création mouvement impossible.');
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <h1 className="text-2xl font-semibold text-[#fff2de]">Argent</h1>
        <p className="mt-2 text-3xl font-bold text-[#ffe5c0]">{formattedBalance}</p>
        {latest ? <p className="mt-2 text-sm text-[#ffe3c3]">Dernière activité: {latest.type} · {Number(latest.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} · {latest.label}</p> : null}
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
            </select>
            <input className="saas-input w-full" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <input className="saas-input w-full" placeholder="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />
            <button className="saas-primary-btn" type="submit">Ajouter</button>
          </form>
        </section>
      ) : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-[#fff1db]">Historique</h2>
        <div className="mt-3 space-y-2">
          {movements.map((movement) => (
            <div key={movement.id} className="rounded-xl border border-white/10 bg-[#5a3924]/55 px-3 py-2 text-sm text-[#ffe4c6]">
              {movement.type} · {Number(movement.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} · {movement.label} ·{' '}
              {new Date(movement.created_at).toLocaleString('fr-FR')}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
