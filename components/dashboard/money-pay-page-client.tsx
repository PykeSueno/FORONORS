'use client';

import { FormEvent, useState } from 'react';
import { formatUsd } from '@/lib/currency';

type Member = { id: string; label: string };
type PaymentRow = { id: number; member_label: string; reason: string; amount: number; created_at: string };

export function MoneyPayPageClient({
  canCreate,
  canHistory,
  balance,
  members,
  payments
}: {
  canCreate: boolean;
  canHistory: boolean;
  balance: number;
  members: Member[];
  payments: PaymentRow[];
}) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    const response = await fetch('/api/money/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_user_id: memberId, amount: Number(amount), reason })
    });

    setSubmitting(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? 'Création paye impossible.');
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <p className="text-sm text-[#efcdab]">Solde groupe actuel</p>
        <p className="text-3xl font-bold text-[#ffe5c0]">{formatUsd(balance)}</p>
      </section>

      {canCreate ? (
        <form className="glass-card space-y-4 p-5" onSubmit={submitPayment}>
          <h3 className="text-lg font-semibold text-[#fff1dd]">Payer un membre</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-[#efcdab]">Membre</p>
              <select className="saas-input w-full" value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="">Sélectionner un membre</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-[#efcdab]">Montant</p>
              <input className="saas-input w-full" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 5000" required />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#efcdab]">Raison</p>
            <input className="saas-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Paye hebdomadaire" required />
          </div>
          {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
          <button className="saas-primary-btn w-full" disabled={submitting}>{submitting ? 'Validation…' : 'Valider la paye'}</button>
        </form>
      ) : null}

      {canHistory ? (
        <section className="glass-card p-5">
          <h3 className="text-lg font-semibold text-[#fff1dd]">Historique des payes</h3>
          <div className="mt-3 space-y-2">
            {payments.map((payment) => (
              <article key={payment.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 px-3 py-2 text-sm text-[#ffe4c6]">
                <p className="font-semibold">🧑‍💼 {payment.member_label} · {formatUsd(payment.amount)}</p>
                <p className="text-xs text-[#efcdab]">{payment.reason.replace(/^Paye:\s*/i, '')} · {new Date(payment.created_at).toLocaleString('fr-FR')}</p>
              </article>
            ))}
            {payments.length === 0 ? <p className="text-sm text-[#f2d2ae]">Aucune paye enregistrée.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
