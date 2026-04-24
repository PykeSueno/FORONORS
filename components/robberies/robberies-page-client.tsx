'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '@/lib/currency';
import { SessionMemberSelector } from '@/components/shared/session-member-selector';

type Item = { id: number; name: string; quantity: number; image_url: string | null };
type Run = { id: number; created_at: string; user_name: string | null; robbery_type: string; money_amount: number; money_after: number | null; consumed_items: Array<{ itemName: string; required: number }>; participants: Array<{ label: string }> };

type RobberyType = 'fleeca' | 'bijouterie' | 'morgue';
const ROBBERY_DEFS: Array<{ key: RobberyType; title: string; icon: string; resources: Array<{ label: string; qty: number }> }> = [
  { key: 'fleeca', title: 'Fleeca', icon: '🏦', resources: [{ label: 'Balle', qty: 1 }, { label: 'Perceuse', qty: 1 }, { label: 'Foret', qty: 4 }, { label: 'Téléphone de hack', qty: 1 }, { label: 'Clé USB', qty: 1 }] },
  { key: 'bijouterie', title: 'Bijouterie', icon: '💎', resources: [{ label: 'Gaz BZ', qty: 1 }, { label: 'Munition', qty: 1 }] },
  { key: 'morgue', title: 'Morgue', icon: '🟥', resources: [{ label: 'Carte rouge', qty: 1 }] }
];

function normalize(value: string) { return value.toLowerCase().replace(/[’']/g, '').trim(); }

export function RobberiesPageClient({ runs, items, members, canCreate, canStats, canLogs, stats }: { runs: Run[]; items: Item[]; members: Array<{ id: string; label: string }>; canCreate: boolean; canStats: boolean; canLogs: boolean; stats: { count: number; fleeca: number; bijouterie: number; morgue: number; moneyTotal: number } }) {
  const router = useRouter();
  const [robberyType, setRobberyType] = useState<RobberyType>('fleeca');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupMode, setGroupMode] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedDef = useMemo(() => ROBBERY_DEFS.find((entry) => entry.key === robberyType) ?? ROBBERY_DEFS[0], [robberyType]);
  const availability = useMemo(() => selectedDef.resources.map((need) => {
    const item = items.find((entry) => normalize(entry.name).includes(normalize(need.label)));
    const stock = Number(item?.quantity ?? 0);
    return { ...need, itemName: item?.name ?? need.label, stock, ok: stock >= need.qty };
  }), [items, selectedDef]);
  const canValidate = canCreate && !saving && moneyAmount > 0 && selectedMembers.length > 0 && availability.every((entry) => entry.ok);

  async function submit() {
    setError('');
    if (!canValidate) return setError('Validation impossible: vérifie participants, stock et montant.');
    setSaving(true);
    const res = await fetch('/api/robberies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robbery_type: robberyType, money_amount: moneyAmount, participant_ids: selectedMembers })
    });
    setSaving(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ message: 'Validation impossible.' }));
      return setError(payload.message ?? 'Validation impossible.');
    }
    setMoneyAmount(0);
    setSelectedMembers([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Choix du braquage</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {ROBBERY_DEFS.map((def) => (
              <button key={def.key} type="button" onClick={() => setRobberyType(def.key)} className={`rounded-xl border p-3 text-left ${robberyType === def.key ? 'border-amber-200/60 bg-[#5a3a27]/70' : 'border-white/10 bg-[#3a2519]/55'}`}>
                <p className="text-lg">{def.icon} {def.title}</p>
                <p className="mt-1 text-xs text-[#efcdab]">{def.resources.map((entry) => `${entry.qty} ${entry.label}`).join(' · ')}</p>
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
            <p className="text-sm font-semibold text-[#ffe8ca]">Disponibilité ressources</p>
            {availability.map((entry) => (
              <p key={entry.label} className={`text-xs ${entry.ok ? 'text-[#c5f2b9]' : 'text-[#f2b9b9]'}`}>{entry.itemName}: {entry.stock} / requis {entry.qty}</p>
            ))}
          </div>
        </article>

        <article className="glass-card space-y-3 p-5">
          <SessionMemberSelector
            members={members}
            selectedMemberIds={selectedMembers}
            onSelectedMemberIdsChange={setSelectedMembers}
            groupMode={groupMode}
            onGroupModeChange={setGroupMode}
            groupLabel="👥 Groupe (désactivé)"
            helperText="Sélectionne les participants du braquage."
          />
          <label className="text-xs text-[#efcdab]">Argent rapporté</label>
          <input className="saas-input" value={moneyAmount} onChange={(event) => setMoneyAmount(Math.max(0, Number(event.target.value || 0)))} />

          <div className="rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3 text-xs text-[#efcdab]">
            <p>Type: <span className="font-semibold text-[#ffe8ca]">{selectedDef.title}</span></p>
            <p>Participants: <span className="font-semibold text-[#ffe8ca]">{selectedMembers.length}</span></p>
            <p>Argent rapporté: <span className="font-semibold text-[#ffe8ca]">{formatUsd(moneyAmount)}</span></p>
          </div>

          {canCreate ? <button type="button" className="saas-primary-btn" disabled={!canValidate} onClick={() => void submit()}>Valider braquage</button> : <p className="text-sm text-[#efcdab]">Permission manquante pour valider.</p>}
          <button type="button" className="saas-ghost-btn" onClick={() => { setMoneyAmount(0); setSelectedMembers([]); setError(''); }}>Annuler</button>
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </article>
      </section>

      {canStats ? (
        <section className="grid gap-2 md:grid-cols-5">
          <Stat label="Braquages semaine" value={String(stats.count)} icon="🧾" />
          <Stat label="Fleeca" value={String(stats.fleeca)} icon="🏦" />
          <Stat label="Bijouterie" value={String(stats.bijouterie)} icon="💎" />
          <Stat label="Morgue" value={String(stats.morgue)} icon="🟥" />
          <Stat label="Argent total" value={formatUsd(stats.moneyTotal)} icon="💵" />
        </section>
      ) : null}

      {canLogs ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique braquage</h3>
          <div className="mt-3 space-y-2">
            {runs.map((run) => (
              <article key={run.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-sm text-[#f1d2ad]">
                <p className="font-semibold text-[#ffe8ca]">{run.robbery_type.toUpperCase()} — {formatUsd(run.money_amount)}</p>
                <p className="text-xs">{run.user_name || 'Groupe'} · {new Date(run.created_at).toLocaleString('fr-FR')}</p>
                <p className="text-xs">Participants: {(run.participants ?? []).map((entry) => entry.label).join(', ') || '—'}</p>
                <p className="text-xs">Ressources: {(run.consumed_items ?? []).map((entry) => `${entry.itemName} x${entry.required}`).join(' · ')}</p>
                <p className="text-xs">Solde après: {run.money_after != null ? formatUsd(run.money_after) : '—'}</p>
              </article>
            ))}
            {runs.length === 0 ? <p className="text-sm text-[#efcdab]">Aucun braquage enregistré.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p></article>;
}
