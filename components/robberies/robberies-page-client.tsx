'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '@/lib/currency';

type Item = { id: number; name: string; quantity: number; image_url: string | null; category_key?: string | null; type_key?: string | null };
type Run = {
  id: number;
  created_at: string;
  user_name: string | null;
  robbery_type: 'fleeca' | 'bijouterie' | 'morgue';
  status?: 'success' | 'arrested';
  money_amount: number;
  lost_money?: number | null;
  money_after: number | null;
  consumed_items: Array<{ itemName: string; required: number }>;
  participants: Array<{ label: string }>;
  note?: string | null;
};

type RobberyType = 'fleeca' | 'bijouterie' | 'morgue';

const ROBBERY_DEFS: Array<{
  key: RobberyType;
  title: string;
  icon: string;
  stockResources: Array<{ label: string; qty: number }>;
  nonStockPrereqs?: string[];
}> = [
  { key: 'fleeca', title: 'Fleeca', icon: '🏦', stockResources: [{ label: 'Munition de Pistolet', qty: 1 }, { label: 'Perceuse', qty: 1 }, { label: 'Foret', qty: 4 }, { label: 'Téléphone de hack', qty: 1 }, { label: 'Clé USB', qty: 1 }] },
  { key: 'bijouterie', title: 'Bijouterie', icon: '💎', stockResources: [{ label: 'Gaz BZ', qty: 1 }, { label: 'Munition de Pistolet', qty: 1 }], nonStockPrereqs: ['Masque à gaz', 'Casse de carton'] },
  { key: 'morgue', title: 'Morgue', icon: '🟥', stockResources: [{ label: 'Carte rouge', qty: 1 }] }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').trim();
}

export function RobberiesPageClient({ runs, items, members, canCreate, canArrested, canStats, canLogs, stats, playerStats }: {
  runs: Run[];
  items: Item[];
  members: Array<{ id: string; label: string }>;
  canCreate: boolean;
  canArrested: boolean;
  canStats: boolean;
  canLogs: boolean;
  stats: { total: number; fleeca: number; bijouterie: number; morgue: number; success: number; arrested: number; moneyIn: number; moneyLost: number; resources: Array<{ name: string; qty: number }> };
  playerStats: Array<{ name: string; total: number; fleeca: number; bijouterie: number; morgue: number; money: number; avg: number; last: string }>;
}) {
  const router = useRouter();
  const [robberyType, setRobberyType] = useState<RobberyType>('fleeca');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [moneyAmount, setMoneyAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [arrestedOpen, setArrestedOpen] = useState(false);
  const [lostMoney, setLostMoney] = useState(0);
  const [seizedNote, setSeizedNote] = useState('');
  const [seizedQuery, setSeizedQuery] = useState('');
  const [seizedCategory, setSeizedCategory] = useState('all');
  const [seizedRows, setSeizedRows] = useState<Array<{ item_id: number; quantity: number }>>([]);

  const selectedDef = useMemo(() => ROBBERY_DEFS.find((entry) => entry.key === robberyType) ?? ROBBERY_DEFS[0], [robberyType]);
  const availability = useMemo(() => selectedDef.stockResources.map((need) => {
    const item = items.find((entry) => normalize(entry.name).includes(normalize(need.label)));
    const stock = Number(item?.quantity ?? 0);
    return { ...need, itemId: item?.id ?? null, itemName: item?.name ?? need.label, image: item?.image_url ?? null, stock, ok: stock >= need.qty };
  }), [items, selectedDef]);

  const canValidate = canCreate && !saving && moneyAmount > 0 && selectedMembers.length > 0 && availability.every((entry) => entry.ok);
  const seizedRowsById = useMemo(() => new Map(seizedRows.map((row) => [row.item_id, row.quantity])), [seizedRows]);
  const filteredSeizableItems = useMemo(() => {
    const q = seizedQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (seizedCategory !== 'all' && (item.category_key ?? 'stock').toLowerCase() !== seizedCategory) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return Number(item.quantity ?? 0) > 0;
    });
  }, [items, seizedCategory, seizedQuery]);

  async function submit(action: 'success' | 'arrested') {
    setError('');
    if (selectedMembers.length === 0) return setError('Sélectionne au moins un participant.');
    if (action === 'success' && !canValidate) return setError('Validation impossible: vérifie participants, stock et montant.');

    const payload = {
      action,
      robbery_type: robberyType,
      money_amount: Math.max(0, moneyAmount),
      lost_money: Math.max(0, lostMoney),
      participant_ids: selectedMembers,
      seized_resources: seizedRows.filter((row) => row.item_id > 0 && row.quantity > 0),
      note: seizedNote
    };

    setSaving(true);
    const res = await fetch('/api/robberies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ message: 'Validation impossible.' }));
      return setError(data.message ?? 'Validation impossible.');
    }

    setMoneyAmount(0);
    setLostMoney(0);
    setSeizedNote('');
    setSeizedRows([]);
    setSelectedMembers([]);
    setArrestedOpen(false);
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
                <p className="mt-1 text-xs text-[#efcdab]">{def.stockResources.map((entry) => `${entry.qty} ${entry.label}`).join(' · ')}</p>
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
            <p className="text-sm font-semibold text-[#ffe8ca]">Ressources stock</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {availability.map((entry) => (
                <div key={entry.label} className={`rounded-lg border px-2 py-2 ${entry.ok ? 'border-emerald-300/25 bg-emerald-500/10' : 'border-rose-300/30 bg-rose-500/10'}`}>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-[#1f120d]">
                      {entry.image ? <Image src={entry.image} alt={entry.itemName} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs">📦</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#ffe8ca]">{entry.itemName}</p>
                      <p className="text-[11px] text-[#efcdab]">Requis {entry.qty} · Dispo {entry.stock}</p>
                    </div>
                    <span className={`text-[10px] font-semibold ${entry.ok ? 'text-[#c5f2b9]' : 'text-[#f2b9b9]'}`}>{entry.ok ? 'OK' : 'Insuffisant'}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedDef.nonStockPrereqs && selectedDef.nonStockPrereqs.length > 0 ? (
              <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 p-2">
                <p className="text-xs font-semibold text-[#ffe8ca]">Prérequis non déduits</p>
                <p className="mt-1 text-xs text-[#efcdab]">{selectedDef.nonStockPrereqs.join(' · ')}</p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="glass-card space-y-3 p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Participants</h3>
          <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-white/10 bg-[#2f1d14]/45 p-2">
            {members.map((member) => {
              const checked = selectedMembers.includes(member.id);
              return (
                <label key={member.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#4f3220]/55 px-2 py-1.5 text-sm text-[#f8e2c6]">
                  <span className="truncate pr-2">{member.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#ffcf9a]"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) setSelectedMembers((cur) => cur.includes(member.id) ? cur : [...cur, member.id]);
                      else setSelectedMembers((cur) => cur.filter((id) => id !== member.id));
                    }}
                  />
                </label>
              );
            })}
          </div>

          <label className="text-xs text-[#efcdab]">Argent rapporté</label>
          <input className="saas-input" value={moneyAmount} onChange={(event) => setMoneyAmount(Math.max(0, Number(event.target.value || 0)))} />

          <div className="grid grid-cols-2 gap-2">
            {canCreate ? <button type="button" className="saas-primary-btn" disabled={!canValidate} onClick={() => void submit('success')}>Valider</button> : <p className="rounded-lg border border-white/10 bg-[#3f281b]/50 px-3 py-2 text-sm text-[#efcdab]">Permission manquante</p>}
            <button type="button" className="saas-ghost-btn" onClick={() => { setMoneyAmount(0); setSelectedMembers([]); setError(''); }}>Annuler</button>
          </div>

          {canArrested ? <button type="button" className="saas-ghost-btn w-full" onClick={() => setArrestedOpen((cur) => !cur)}>🚔 Braquage arrêté</button> : null}
          {arrestedOpen ? (
            <div className="space-y-3 rounded-xl border border-rose-200/20 bg-rose-500/10 p-4">
              <p className="text-sm font-semibold text-[#ffe8ca]">Braquage arrêté</p>
              <label className="text-xs text-[#efcdab]">Argent perdu / saisi</label>
              <input className="saas-input" value={lostMoney} onChange={(event) => setLostMoney(Math.max(0, Number(event.target.value || 0)))} />

              <label className="text-xs text-[#efcdab]">Ressources saisies (stock)</label>
              <div className="grid gap-2 md:grid-cols-[1fr_10rem]">
                <input className="saas-input" placeholder="Recherche item" value={seizedQuery} onChange={(e) => setSeizedQuery(e.target.value)} />
                <select className="saas-input" value={seizedCategory} onChange={(e) => setSeizedCategory(e.target.value)}>
                  <option value="all">Toutes catégories</option>
                  <option value="objects">Objets</option>
                  <option value="equipment">Équipement</option>
                  <option value="drugs">Drogues</option>
                </select>
              </div>
              <div className="max-h-52 space-y-1 overflow-auto rounded-xl border border-white/10 bg-[#2f1d14]/45 p-2">
                {filteredSeizableItems.map((item) => {
                  const selectedQty = seizedRowsById.get(item.id) ?? 0;
                  return (
                    <div key={item.id} className="grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/10 bg-[#4f3220]/45 px-2 py-1.5">
                      <div className="h-8 w-8 overflow-hidden rounded-md border border-white/10 bg-[#1f120d]">
                        {item.image_url ? <Image src={item.image_url} alt={item.name} width={32} height={32} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[10px]">📦</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#ffe8ca]">{item.name}</p>
                        <p className="text-[10px] text-[#efcdab]">{item.category_key || 'stock'} · Dispo {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" className="saas-ghost-btn !h-7 !min-h-7 !px-2 !py-0" onClick={() => setSeizedRows((cur) => {
                          const current = cur.find((row) => row.item_id === item.id);
                          if (!current) return cur;
                          if (current.quantity <= 1) return cur.filter((row) => row.item_id !== item.id);
                          return cur.map((row) => row.item_id === item.id ? { ...row, quantity: row.quantity - 1 } : row);
                        })}>−</button>
                        <span className="w-6 text-center text-xs text-[#ffe8ca]">{selectedQty}</span>
                        <button type="button" className="saas-ghost-btn !h-7 !min-h-7 !px-2 !py-0" onClick={() => setSeizedRows((cur) => {
                          const current = cur.find((row) => row.item_id === item.id);
                          if (!current) return [...cur, { item_id: item.id, quantity: 1 }];
                          if (current.quantity >= Number(item.quantity)) return cur;
                          return cur.map((row) => row.item_id === item.id ? { ...row, quantity: row.quantity + 1 } : row);
                        })}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="text-xs text-[#efcdab]">Note (optionnelle)</label>
              <textarea className="saas-input h-20" value={seizedNote} onChange={(e) => setSeizedNote(e.target.value)} />

              <button type="button" className="saas-primary-btn w-full" onClick={() => void submit('arrested')}>Valider braquage arrêté</button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </article>
      </section>

      {canStats ? (
        <section className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5 xl:grid-cols-10">
            <Stat label="Total" value={String(stats.total)} icon="🧾" />
            <Stat label="Fleeca" value={String(stats.fleeca)} icon="🏦" />
            <Stat label="Bijouterie" value={String(stats.bijouterie)} icon="💎" />
            <Stat label="Morgue" value={String(stats.morgue)} icon="🟥" />
            <Stat label="Réussis" value={String(stats.success)} icon="✅" />
            <Stat label="Arrêtés" value={String(stats.arrested)} icon="🚔" />
            <Stat label="Argent rentré" value={formatUsd(stats.moneyIn)} icon="💵" />
            <Stat label="Argent perdu" value={formatUsd(stats.moneyLost)} icon="💸" />
            <Stat label="Bénéfice net" value={formatUsd(stats.moneyIn - stats.moneyLost)} icon="📈" />
            <Stat label="Ressources" value={String(stats.resources.reduce((sum, row) => sum + row.qty, 0))} icon="📦" />
          </div>
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Classement participants (semaine)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-[#efcdab]">
                <thead className="text-[#ffe8ca]"><tr><th className="px-2 py-1">Joueur</th><th className="px-2 py-1">Braquages</th><th className="px-2 py-1">Fleeca</th><th className="px-2 py-1">Bijouterie</th><th className="px-2 py-1">Morgue</th><th className="px-2 py-1">Argent total</th><th className="px-2 py-1">Moyenne</th><th className="px-2 py-1">Dernière</th></tr></thead>
                <tbody>
                  {playerStats.map((row, idx) => (
                    <tr key={`${row.name}-${idx}`} className="border-t border-white/10"><td className="px-2 py-1 text-[#ffe8ca]">{row.name}</td><td className="px-2 py-1">{row.total}</td><td className="px-2 py-1">{row.fleeca}</td><td className="px-2 py-1">{row.bijouterie}</td><td className="px-2 py-1">{row.morgue}</td><td className="px-2 py-1">{formatUsd(row.money)}</td><td className="px-2 py-1">{formatUsd(row.avg)}</td><td className="px-2 py-1">{new Date(row.last).toLocaleString('fr-FR')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.resources.length > 0 ? <p className="mt-2 text-xs text-[#efcdab]">Ressources les plus consommées: {stats.resources.map((row) => `${row.name} x${row.qty}`).join(' · ')}</p> : null}
          </article>
        </section>
      ) : null}

      {canLogs ? (
        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Historique braquage</h3>
          <div className="mt-3 space-y-2">
            {runs.map((run) => (
              <article key={run.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-sm text-[#f1d2ad]">
                <p className="font-semibold text-[#ffe8ca]">{(run.status ?? 'success') === 'success' ? '✅' : '🚔'} {run.robbery_type.toUpperCase()} — {(run.status ?? 'success') === 'success' ? formatUsd(run.money_amount) : `Perte ${formatUsd(Number(run.lost_money ?? 0))}`}</p>
                <p className="text-xs">{run.user_name || 'Groupe'} · {new Date(run.created_at).toLocaleString('fr-FR')}</p>
                <p className="text-xs">Participants: {(run.participants ?? []).map((entry) => entry.label).join(', ') || '—'}</p>
                <p className="text-xs">Ressources: {(run.consumed_items ?? []).map((entry) => `${entry.itemName} x${entry.required}`).join(' · ') || '—'}</p>
                <p className="text-xs">Solde après: {run.money_after != null ? formatUsd(run.money_after) : '—'}</p>
                {run.note ? <p className="text-xs">Note: {run.note}</p> : null}
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
