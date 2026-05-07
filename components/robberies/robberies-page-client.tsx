'use client';

import Image from 'next/image';
import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';

type Item = { id: number; name: string; quantity: number; image_url: string | null; category_key?: string | null; type_key?: string | null };
type RoleKey = 'braqueur' | 'plan_mule_recup' | 'otage_apporte';
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
  participants: Array<{ id?: string; label: string; role?: string }>;
  note?: string | null;
};
type RobberyType = 'fleeca' | 'bijouterie' | 'morgue';
type RoleStats = { memberId: string; name: string; total: number; braqueur: number; braqueurMoney: number; braqueurLast: string | null; mule: number; muleSuccess: number; muleLast: string | null; hostage: number; hostageLast: string | null; recentBraqueur: number; recentMule: number; recentHostage: number };
type Suggestion = { title: string; icon: string; names: Array<{ name: string; reason: string; score: number }> };
type InsightPanel = 'suggestions' | 'history' | 'weekly' | 'braqueurs' | 'mules' | 'hostages';

const ROBBERY_DEFS: Array<{ key: RobberyType; title: string; icon: string; stockResources: Array<{ label: string; qty: number }>; optionalStockResources?: Array<{ label: string; defaultQty: number }>; nonStockPrereqs?: string[] }> = [
  { key: 'fleeca', title: 'Fleeca', icon: '🏦', stockResources: [{ label: 'Pétoire', qty: 1 }, { label: 'Munition de Pistolet', qty: 1 }, { label: 'Perceuse', qty: 1 }, { label: 'Foret', qty: 4 }, { label: 'Clé USB', qty: 1 }], optionalStockResources: [{ label: 'Menu', defaultQty: 0 }] },
  { key: 'bijouterie', title: 'Bijouterie', icon: '💎', stockResources: [{ label: 'Gaz BZ', qty: 1 }, { label: 'Munition de Pistolet', qty: 1 }], optionalStockResources: [{ label: 'Menu', defaultQty: 0 }], nonStockPrereqs: ['Masque à gaz', 'Casse de carton'] },
  { key: 'morgue', title: 'Morgue', icon: '🟥', stockResources: [{ label: 'Carte rouge', qty: 1 }] }
];

function normalize(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').trim(); }
function weekStartIso(now: Date) { const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay()); return start.toISOString(); }
function roleLabel(role?: string) { if (role === 'braqueur') return 'Braqueur'; if (role === 'plan_mule_recup') return 'Mule / Récup'; if (role === 'otage_apporte') return 'Otage'; return 'Participant'; }
function roleIcon(role?: string) { if (role === 'braqueur') return '🎯'; if (role === 'plan_mule_recup') return '🚗'; if (role === 'otage_apporte') return '🤝'; return '👤'; }
function lastLabel(value: string | null) { return value ? new Date(value).toLocaleDateString('fr-FR') : 'Jamais'; }
function lastTime(value: string | null) { return value ? new Date(value).getTime() : 0; }
function isSuccess(run: Run) { return (run.status ?? 'success') === 'success'; }
function ageDays(value: string | null) { if (!value) return 999; const diff = Date.now() - new Date(value).getTime(); return Number.isFinite(diff) ? Math.max(0, diff / 86400000) : 999; }
function recentWeight(createdAt: string) { const age = ageDays(createdAt); if (age <= 14) return 2; if (age <= 30) return 1; if (age <= 60) return 0.45; return 0.15; }
function roleCount(row: RoleStats, role: RoleKey) { return role === 'braqueur' ? row.braqueur : role === 'plan_mule_recup' ? row.mule : row.hostage; }
function roleRecent(row: RoleStats, role: RoleKey) { return role === 'braqueur' ? row.recentBraqueur : role === 'plan_mule_recup' ? row.recentMule : row.recentHostage; }
function roleLast(row: RoleStats, role: RoleKey) { return role === 'braqueur' ? row.braqueurLast : role === 'plan_mule_recup' ? row.muleLast : row.hostageLast; }
function roleShortLabel(role: RoleKey) { return role === 'braqueur' ? 'braqueur' : role === 'plan_mule_recup' ? 'mule/récup' : 'otage'; }
function otherRecent(row: RoleStats, role: RoleKey) { return role === 'braqueur' ? row.recentMule + row.recentHostage : role === 'plan_mule_recup' ? row.recentBraqueur + row.recentHostage : row.recentBraqueur + row.recentMule; }

function buildRoleStats(runs: Run[], members: Array<{ id: string; label: string }>) {
  const rows = new Map<string, RoleStats>();
  const activeMemberIds = new Set(members.map((member) => member.id));
  const emptyStats = (memberId: string, name: string): RoleStats => ({ memberId, name, total: 0, braqueur: 0, braqueurMoney: 0, braqueurLast: null, mule: 0, muleSuccess: 0, muleLast: null, hostage: 0, hostageLast: null, recentBraqueur: 0, recentMule: 0, recentHostage: 0 });
  for (const member of members) rows.set(member.id, emptyStats(member.id, member.label));
  for (const run of runs) {
    const activeParticipants = (run.participants ?? []).filter((entry) => entry.id && activeMemberIds.has(entry.id));
    const braqueurs = activeParticipants.filter((entry) => entry.role === 'braqueur');
    const braqueurShare = braqueurs.length > 0 ? Number(run.money_amount ?? 0) / braqueurs.length : 0;
    const weight = recentWeight(run.created_at);
    for (const participant of activeParticipants) {
      const key = participant.id as string;
      const row = rows.get(key) ?? emptyStats(key, participant.label);
      if (participant.role === 'braqueur') { row.braqueur += 1; row.recentBraqueur += weight; row.braqueurMoney += braqueurShare; if (!row.braqueurLast || run.created_at > row.braqueurLast) row.braqueurLast = run.created_at; }
      if (participant.role === 'plan_mule_recup') { row.mule += 1; row.recentMule += weight; if (isSuccess(run)) row.muleSuccess += 1; if (!row.muleLast || run.created_at > row.muleLast) row.muleLast = run.created_at; }
      if (participant.role === 'otage_apporte') { row.hostage += 1; row.recentHostage += weight; if (!row.hostageLast || run.created_at > row.hostageLast) row.hostageLast = run.created_at; }
      if (participant.role === 'braqueur' || participant.role === 'plan_mule_recup' || participant.role === 'otage_apporte') row.total += 1;
      rows.set(key, row);
    }
  }
  return Array.from(rows.values());
}

function rotationScore(row: RoleStats, role: RoleKey) {
  const targetCount = roleCount(row, role);
  const recentTarget = roleRecent(row, role);
  const idleBonus = Math.min(26, ageDays(roleLast(row, role)) / 3);
  const lowRoleBonus = Math.max(0, 4 - targetCount) * 7;
  const helpBonus = Math.min(24, otherRecent(row, role) * (role === 'braqueur' ? 7 : 4));
  const participationBonus = Math.min(12, Math.max(0, row.total - targetCount) * 1.8);
  let score = 55 + idleBonus + lowRoleBonus + helpBonus + participationBonus - recentTarget * 18 - targetCount * 2.5;
  if (role === 'braqueur') score += row.recentMule * 6 + row.recentHostage * 5 - row.recentBraqueur * 7;
  if (role === 'plan_mule_recup') score += (row.recentBraqueur + row.recentHostage) * 3 - row.recentMule * 7;
  if (role === 'otage_apporte') score += (row.recentBraqueur + row.recentMule) * 3 - row.recentHostage * 7;
  return score;
}

function rotationReason(row: RoleStats, role: RoleKey, score: number) {
  const label = roleShortLabel(role);
  const targetCount = roleCount(row, role);
  const recentTarget = roleRecent(row, role);
  const other = otherRecent(row, role);
  const days = ageDays(roleLast(row, role));
  if (role === 'braqueur' && row.recentBraqueur < 0.5 && row.recentMule + row.recentHostage >= 1) {
    return `${row.name} monte en braqueur: il a aidé récemment en mule/récup ou otage sans prendre le rôle principal.`;
  }
  if (recentTarget >= 2) {
    return `${row.name} reste dans la liste avec ${Math.round(score)} pts, mais son score est réduit car il a déjà tenu le rôle ${label} récemment.`;
  }
  if (targetCount === 0) {
    return `${row.name} est prioritaire: aucun passage enregistré en ${label}, la rotation l’avantage.`;
  }
  if (days >= 21) {
    return `${row.name} remonte en ${label}: son dernier passage date d’environ ${Math.round(days)} jours.`;
  }
  if (other >= 1.5) {
    return `${row.name} est favorisé en ${label}: il a davantage aidé sur d’autres rôles que sur celui-ci.`;
  }
  return `${row.name} ressort en ${label} grâce à un équilibre faible volume, participation et ancienneté du rôle.`;
}

function suggest(rows: RoleStats[], role: RoleKey, limit: number): Suggestion['names'] {
  return [...rows]
    .map((row) => ({ row, score: rotationScore(row, role) }))
    .sort((a, b) => b.score - a.score || lastTime(roleLast(a.row, role)) - lastTime(roleLast(b.row, role)) || a.row.total - b.row.total || a.row.name.localeCompare(b.row.name, 'fr'))
    .slice(0, limit)
    .map(({ row, score }) => ({ name: row.name, score: Math.round(score), reason: rotationReason(row, role, score) }));
}

export function RobberiesPageClient({ runs, items, members, canCreate, canArrested, canStats, canLogs }: {
  runs: Run[];
  items: Item[];
  members: Array<{ id: string; label: string }>;
  canCreate: boolean;
  canArrested: boolean;
  canStats: boolean;
  canLogs: boolean;
}) {
  const [currentRuns, setCurrentRuns] = useState(runs);
  const [currentItems, setCurrentItems] = useState(items);
  const [robberyType, setRobberyType] = useState<RobberyType>('fleeca');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [braqueurIds, setBraqueurIds] = useState<string[]>([]);
  const [hostageIds, setHostageIds] = useState<string[]>([]);
  const [muleIds, setMuleIds] = useState<string[]>([]);
  const [moneyAmount, setMoneyAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [arrestedOpen, setArrestedOpen] = useState(false);
  const [lostMoney, setLostMoney] = useState(0);
  const [seizedNote, setSeizedNote] = useState('');
  const [seizedQuery, setSeizedQuery] = useState('');
  const [seizedCategory, setSeizedCategory] = useState('all');
  const [seizedRows, setSeizedRows] = useState<Array<{ item_id: number; quantity: number }>>([]);
  const [optionalMenuQtyByType, setOptionalMenuQtyByType] = useState<Record<RobberyType, number>>({ fleeca: 0, bijouterie: 0, morgue: 0 });
  const [insightPanel, setInsightPanel] = useState<InsightPanel>(canStats ? 'suggestions' : 'history');

  const roleStats = useMemo(() => buildRoleStats(currentRuns, members), [currentRuns, members]);
  const rotationSuggestions = useMemo<Suggestion[]>(() => [
    { title: '4 Braqueurs conseillés', icon: '🎯', names: suggest(roleStats, 'braqueur', 4) },
    { title: '2 Mule / récup conseillés', icon: '🚗', names: suggest(roleStats, 'plan_mule_recup', 2) }
  ], [roleStats]);

  const roleBlocks: Array<{ title: string; values: string[]; setValues: Dispatch<SetStateAction<string[]>> }> = [
    { title: 'Braqueurs', values: braqueurIds, setValues: setBraqueurIds },
    { title: 'Otages apportés', values: hostageIds, setValues: setHostageIds },
    { title: 'Plan Mule / Récup', values: muleIds, setValues: setMuleIds }
  ];
  const selectedDef = useMemo(() => ROBBERY_DEFS.find((entry) => entry.key === robberyType) ?? ROBBERY_DEFS[0], [robberyType]);
  const availability = useMemo(() => selectedDef.stockResources.map((need) => { const item = currentItems.find((entry) => normalize(entry.name).includes(normalize(need.label))); const stock = Number(item?.quantity ?? 0); return { ...need, itemId: item?.id ?? null, itemName: item?.name ?? need.label, image: item?.image_url ?? null, stock, ok: stock >= need.qty }; }), [currentItems, selectedDef]);
  const menuAvailability = useMemo(() => {
    const need = selectedDef.optionalStockResources?.find((entry) => normalize(entry.label) === 'menu');
    if (!need) return null;
    const item = currentItems.find((entry) => normalize(entry.name).includes('menu'));
    const stock = Number(item?.quantity ?? 0);
    const qty = Math.min(Math.max(0, optionalMenuQtyByType[robberyType] ?? need.defaultQty), stock);
    return { ...need, itemId: item?.id ?? null, itemName: item?.name ?? need.label, image: item?.image_url ?? null, stock, qty, ok: qty <= stock };
  }, [currentItems, optionalMenuQtyByType, robberyType, selectedDef]);
  const canValidate = canCreate && !saving && moneyAmount > 0 && selectedMembers.length > 0 && availability.every((entry) => entry.ok) && (menuAvailability?.ok ?? true);
  const seizedRowsById = useMemo(() => new Map(seizedRows.map((row) => [row.item_id, row.quantity])), [seizedRows]);
  const filteredSeizableItems = useMemo(() => { const q = seizedQuery.trim().toLowerCase(); return currentItems.filter((item) => (seizedCategory === 'all' || (item.category_key ?? 'stock').toLowerCase() === seizedCategory) && (!q || item.name.toLowerCase().includes(q)) && Number(item.quantity ?? 0) > 0); }, [currentItems, seizedCategory, seizedQuery]);
  const activeMemberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const weekRuns = useMemo(() => {
    const weekIso = weekStartIso(new Date());
    return currentRuns.filter((run) => run.created_at >= weekIso && (run.participants ?? []).some((participant) => participant.id && activeMemberIds.has(participant.id)));
  }, [activeMemberIds, currentRuns]);
  const computedStats = useMemo(() => {
    const resources = new Map<string, number>();
    for (const run of weekRuns) {
      for (const consumed of run.consumed_items ?? []) resources.set(consumed.itemName, (resources.get(consumed.itemName) ?? 0) + Number(consumed.required ?? 0));
    }
    return {
      total: weekRuns.length,
      fleeca: weekRuns.filter((run) => run.robbery_type === 'fleeca').length,
      bijouterie: weekRuns.filter((run) => run.robbery_type === 'bijouterie').length,
      morgue: weekRuns.filter((run) => run.robbery_type === 'morgue').length,
      success: weekRuns.filter((run) => (run.status ?? 'success') === 'success').length,
      arrested: weekRuns.filter((run) => (run.status ?? 'success') === 'arrested').length,
      moneyIn: weekRuns.reduce((sum, run) => sum + Number(run.money_amount ?? 0), 0),
      moneyLost: weekRuns.reduce((sum, run) => sum + Number(run.lost_money ?? 0), 0),
      resources: Array.from(resources.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8)
    };
  }, [weekRuns]);
  const computedPlayerStats = useMemo(() => {
    const playerMap = new Map<string, { name: string; total: number; fleeca: number; bijouterie: number; morgue: number; money: number; last: string }>();
    for (const run of weekRuns) {
      for (const participant of run.participants ?? []) {
        if (!participant.id || !activeMemberIds.has(participant.id)) continue;
        const prev = playerMap.get(participant.id) ?? { name: participant.label, total: 0, fleeca: 0, bijouterie: 0, morgue: 0, money: 0, last: run.created_at };
        prev.total += 1;
        prev[run.robbery_type] += 1;
        prev.money += Number(run.money_amount ?? 0);
        if (new Date(run.created_at).getTime() > new Date(prev.last).getTime()) prev.last = run.created_at;
        playerMap.set(participant.id, prev);
      }
    }
    return Array.from(playerMap.values()).map((entry) => ({ ...entry, avg: entry.total > 0 ? entry.money / entry.total : 0 })).sort((a, b) => b.total - a.total || b.money - a.money);
  }, [activeMemberIds, weekRuns]);

  async function submit(action: 'success' | 'arrested') {
    setError('');
    if (selectedMembers.length === 0) return setError('Sélectionne au moins un participant.');
    if (action === 'success' && !canValidate) return setError('Validation impossible: vérifie participants, stock et montant.');
    if (action === 'success' && menuAvailability && menuAvailability.qty > menuAvailability.stock) return setError('Stock Menu insuffisant.');
    const optional_resources = menuAvailability ? [{ name: 'Menu', item_id: menuAvailability.itemId ?? undefined, quantity: menuAvailability.qty }] : [];
    const payload = { action, robbery_type: robberyType, money_amount: Math.max(0, moneyAmount), lost_money: Math.max(0, lostMoney), participant_ids: selectedMembers, braqueur_ids: braqueurIds, hostage_ids: hostageIds, mule_ids: muleIds, optional_resources, seized_resources: seizedRows.filter((row) => row.item_id > 0 && row.quantity > 0), note: seizedNote };
    setSaving(true);
    const res = await fetch('/api/robberies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { const data = await res.json().catch(() => ({ message: 'Validation impossible.' })); return setError(data.message ?? 'Validation impossible.'); }
    const data = await res.json().catch(() => null) as { run?: Run; itemUpdates?: Array<{ id: number; quantity: number }> } | null;
    if (data?.itemUpdates?.length) setCurrentItems((cur) => cur.map((item) => {
      const update = data.itemUpdates?.find((entry) => entry.id === item.id);
      return update ? { ...item, quantity: update.quantity } : item;
    }));
    if (data?.run) setCurrentRuns((cur) => [data.run as Run, ...cur]);
    setMoneyAmount(0); setLostMoney(0); setSeizedNote(''); setSeizedRows([]); setSelectedMembers([]); setBraqueurIds([]); setHostageIds([]); setMuleIds([]); setArrestedOpen(false); setOptionalMenuQtyByType((cur) => ({ ...cur, [robberyType]: 0 }));
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Choix du braquage</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-3">{ROBBERY_DEFS.map((def) => <button key={def.key} type="button" onClick={() => setRobberyType(def.key)} className={`rounded-xl border p-3 text-left ${robberyType === def.key ? 'border-amber-200/60 bg-[#5a3a27]/70' : 'border-white/10 bg-[#3a2519]/55'}`}><p className="text-lg">{def.icon} {def.title}</p><p className="mt-1 text-xs text-[#efcdab]">{def.stockResources.map((entry) => `${entry.qty} ${entry.label}`).join(' · ')}{def.optionalStockResources?.length ? ` · ${def.optionalStockResources.map((entry) => `${entry.label} optionnel`).join(' · ')}` : ''}</p></button>)}</div>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3"><p className="text-sm font-semibold text-[#ffe8ca]">Ressources stock</p><div className="mt-2 grid gap-2 md:grid-cols-2">{availability.map((entry) => <div key={entry.label} className={`rounded-lg border px-2 py-2 ${entry.ok ? 'border-emerald-300/25 bg-emerald-500/10' : 'border-rose-300/30 bg-rose-500/10'}`}><div className="flex items-center gap-2"><div className="h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-[#1f120d]">{entry.image ? <Image src={entry.image} alt={entry.itemName} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs">📦</div>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#ffe8ca]">{entry.itemName}</p><p className="text-[11px] text-[#efcdab]">Requis {entry.qty} · Dispo {entry.stock}</p></div><span className={`text-[10px] font-semibold ${entry.ok ? 'text-[#c5f2b9]' : 'text-[#f2b9b9]'}`}>{entry.ok ? 'OK' : 'Insuffisant'}</span></div></div>)}</div>{menuAvailability ? <div className="mt-3 rounded-lg border border-sky-300/25 bg-sky-500/10 p-2"><p className="text-xs font-semibold text-[#ffe8ca]">Ressource optionnelle</p><div className="mt-2 grid gap-2 sm:grid-cols-[2.4rem_minmax(0,1fr)_9rem] sm:items-center"><div className="h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-[#1f120d]">{menuAvailability.image ? <Image src={menuAvailability.image} alt={menuAvailability.itemName} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs">📦</div>}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#ffe8ca]">{menuAvailability.itemName}</p><p className="text-[11px] text-[#efcdab]">Défaut 0 · Dispo {menuAvailability.stock}</p></div><QuantityMiniStepper value={menuAvailability.qty} max={menuAvailability.stock} onChange={(next) => setOptionalMenuQtyByType((cur) => ({ ...cur, [robberyType]: next }))} /></div>{menuAvailability.qty > 0 ? <p className="mt-1 text-[11px] text-[#d7ebff]">Retirera {menuAvailability.qty} Menu du stock.</p> : <p className="mt-1 text-[11px] text-[#efcdab]">Quantité 0: aucun Menu retiré.</p>}</div> : null}{selectedDef.nonStockPrereqs?.length ? <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 p-2"><p className="text-xs font-semibold text-[#ffe8ca]">Prérequis non déduits</p><p className="mt-1 text-xs text-[#efcdab]">{selectedDef.nonStockPrereqs.join(' · ')}</p></div> : null}</div>
        </article>

        <article className="glass-card space-y-3 p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Participants par rôle</h3>
          {roleBlocks.map(({ title, values, setValues }) => <div key={title}><p className="mb-1 text-xs text-[#efcdab]">{title}</p><div className="max-h-32 space-y-1 overflow-auto rounded-xl border border-white/10 bg-[#2f1d14]/45 p-2">{members.map((member) => { const checked = values.includes(member.id); return <label key={`${title}-${member.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#4f3220]/55 px-2 py-1.5 text-sm text-[#f8e2c6]"><span className="truncate pr-2">{member.label}</span><input type="checkbox" className="h-4 w-4 accent-[#ffcf9a]" checked={checked} onChange={(event) => { if (event.target.checked) { setSelectedMembers((cur) => cur.includes(member.id) ? cur : [...cur, member.id]); setValues((cur) => cur.includes(member.id) ? cur : [...cur, member.id]); } else { setValues((cur) => cur.filter((id) => id !== member.id)); } }} /></label>; })}</div></div>)}
          <p className="text-xs text-[#efcdab]">Récap: Braqueurs {braqueurIds.length} · Otages {hostageIds.length} · Plan Mule/Récup {muleIds.length}</p>
          <label className="text-xs text-[#efcdab]">Argent rapporté</label><input className="saas-input" value={moneyAmount} onChange={(event) => setMoneyAmount(Math.max(0, Number(event.target.value || 0)))} />
          <div className="grid grid-cols-2 gap-2">{canCreate ? <button type="button" className="saas-primary-btn" disabled={!canValidate} onClick={() => void submit('success')}>✅ Valider</button> : <p className="rounded-lg border border-white/10 bg-[#3f281b]/50 px-3 py-2 text-sm text-[#efcdab]">Permission manquante</p>}<button type="button" className="saas-ghost-btn" onClick={() => { setMoneyAmount(0); setSelectedMembers([]); setBraqueurIds([]); setHostageIds([]); setMuleIds([]); setError(''); }}>Annuler</button></div>
          {canArrested ? <button type="button" className="saas-ghost-btn w-full" onClick={() => setArrestedOpen((cur) => !cur)}>🚔 Braquage arrêté</button> : null}
          {arrestedOpen ? <ArrestedBox lostMoney={lostMoney} setLostMoney={setLostMoney} seizedNote={seizedNote} setSeizedNote={setSeizedNote} seizedQuery={seizedQuery} setSeizedQuery={setSeizedQuery} seizedCategory={seizedCategory} setSeizedCategory={setSeizedCategory} filteredItems={filteredSeizableItems} seizedRowsById={seizedRowsById} setSeizedRows={setSeizedRows} submit={() => submit('arrested')} /> : null}
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </article>
      </section>

      {canStats ? <div className="grid gap-2 md:grid-cols-5 xl:grid-cols-10"><Stat label="Total" value={String(computedStats.total)} icon="🧾" /><Stat label="Fleeca" value={String(computedStats.fleeca)} icon="🏦" /><Stat label="Bijouterie" value={String(computedStats.bijouterie)} icon="💎" /><Stat label="Morgue" value={String(computedStats.morgue)} icon="🟥" /><Stat label="Réussis" value={String(computedStats.success)} icon="✅" /><Stat label="Arrêtés" value={String(computedStats.arrested)} icon="🚔" /><Stat label="Argent rentré" value={formatUsd(computedStats.moneyIn)} icon="💵" /><Stat label="Argent perdu" value={formatUsd(computedStats.moneyLost)} icon="💸" /><Stat label="Bénéfice net" value={formatUsd(computedStats.moneyIn - computedStats.moneyLost)} icon="📈" /><Stat label="Ressources" value={String(computedStats.resources.reduce((sum, row) => sum + row.qty, 0))} icon="📦" /></div> : null}
      {canStats || canLogs ? <RobberyInsights active={insightPanel} setActive={setInsightPanel} canStats={canStats} canLogs={canLogs} suggestions={rotationSuggestions} runs={currentRuns} roleStats={roleStats} playerStats={computedPlayerStats} resources={computedStats.resources} /> : null}
    </div>
  );
}

function QuantityMiniStepper({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  const safeValue = Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
  return <div className="grid grid-cols-[2.2rem_minmax(2.4rem,1fr)_2.2rem] items-center gap-1"><button type="button" className="saas-ghost-btn !h-9 !min-h-9 !px-0 !py-0" disabled={safeValue <= 0} onClick={() => onChange(Math.max(0, safeValue - 1))}>−</button><div className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#24160f] px-2 text-sm font-semibold text-[#ffe8ca]">{safeValue}</div><button type="button" className="saas-ghost-btn !h-9 !min-h-9 !px-0 !py-0" disabled={safeValue >= max} onClick={() => onChange(Math.min(max, safeValue + 1))}>+</button></div>;
}

function RobberyInsights(props: { active: InsightPanel; setActive: Dispatch<SetStateAction<InsightPanel>>; canStats: boolean; canLogs: boolean; suggestions: Suggestion[]; runs: Run[]; roleStats: RoleStats[]; playerStats: Array<{ name: string; total: number; fleeca: number; bijouterie: number; morgue: number; money: number; avg: number; last: string }>; resources: Array<{ name: string; qty: number }> }) {
  const tabs = [
    props.canStats ? { key: 'suggestions' as const, label: '🔁 Suggestions' } : null,
    props.canLogs ? { key: 'history' as const, label: '📜 Historique' } : null,
    props.canStats ? { key: 'weekly' as const, label: '🏆 Classement semaine' } : null,
    props.canStats ? { key: 'braqueurs' as const, label: '🎯 Classement braqueurs' } : null,
    props.canStats ? { key: 'mules' as const, label: '🚗 Classement mule/récup' } : null,
    props.canStats ? { key: 'hostages' as const, label: '🤝 Classement otages' } : null
  ].filter(Boolean) as Array<{ key: InsightPanel; label: string }>;
  const active = tabs.some((tab) => tab.key === props.active) ? props.active : tabs[0]?.key;

  return (
    <section className="glass-card p-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => <button key={tab.key} type="button" className={`filter-pill ${active === tab.key ? 'filter-pill-active' : ''}`} onClick={() => props.setActive(tab.key)}>{tab.label}</button>)}
      </div>
      <div className="mt-4">
        {active === 'suggestions' ? <RotationSuggestions suggestions={props.suggestions} /> : null}
        {active === 'history' ? <div className="space-y-2">{props.runs.map((run) => <HistoryCard key={run.id} run={run} />)}{props.runs.length === 0 ? <p className="text-sm text-[#efcdab]">Aucun braquage enregistré.</p> : null}</div> : null}
        {active === 'weekly' ? <LegacyRanking rows={props.playerStats} resources={props.resources} /> : null}
        {active === 'braqueurs' ? <RoleRanking title="Classement braqueurs" icon="🎯" rows={props.roleStats} role="braqueur" /> : null}
        {active === 'mules' ? <RoleRanking title="Classement mules / récup" icon="🚗" rows={props.roleStats} role="plan_mule_recup" /> : null}
        {active === 'hostages' ? <RoleRanking title="Classement otages" icon="🤝" rows={props.roleStats} role="otage_apporte" /> : null}
      </div>
    </section>
  );
}

function ArrestedBox(props: { lostMoney: number; setLostMoney: (v: number) => void; seizedNote: string; setSeizedNote: (v: string) => void; seizedQuery: string; setSeizedQuery: (v: string) => void; seizedCategory: string; setSeizedCategory: (v: string) => void; filteredItems: Item[]; seizedRowsById: Map<number, number>; setSeizedRows: Dispatch<SetStateAction<Array<{ item_id: number; quantity: number }>>>; submit: () => Promise<void> }) {
  return <div className="space-y-3 rounded-xl border border-rose-200/20 bg-rose-500/10 p-4"><p className="text-sm font-semibold text-[#ffe8ca]">Braquage arrêté</p><label className="text-xs text-[#efcdab]">Argent perdu / saisi</label><input className="saas-input" value={props.lostMoney} onChange={(event) => props.setLostMoney(Math.max(0, Number(event.target.value || 0)))} /><label className="text-xs text-[#efcdab]">Ressources saisies (stock)</label><div className="grid gap-2 md:grid-cols-[1fr_10rem]"><input className="saas-input" placeholder="Recherche item" value={props.seizedQuery} onChange={(e) => props.setSeizedQuery(e.target.value)} /><select className="saas-input" value={props.seizedCategory} onChange={(e) => props.setSeizedCategory(e.target.value)}><option value="all">Toutes catégories</option><option value="objects">Objets</option><option value="equipment">Équipement</option><option value="drugs">Drogues</option></select></div><div className="max-h-52 space-y-1 overflow-auto rounded-xl border border-white/10 bg-[#2f1d14]/45 p-2">{props.filteredItems.map((item) => { const selectedQty = props.seizedRowsById.get(item.id) ?? 0; return <div key={item.id} className="grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/10 bg-[#4f3220]/45 px-2 py-1.5"><div className="h-8 w-8 overflow-hidden rounded-md border border-white/10 bg-[#1f120d]">{item.image_url ? <Image src={item.image_url} alt={item.name} width={32} height={32} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[10px]">📦</div>}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#ffe8ca]">{item.name}</p><p className="text-[10px] text-[#efcdab]">{item.category_key || 'stock'} · Dispo {item.quantity}</p></div><div className="flex items-center gap-1"><button type="button" className="saas-ghost-btn !h-7 !min-h-7 !px-2 !py-0" onClick={() => props.setSeizedRows((cur) => { const current = cur.find((row) => row.item_id === item.id); if (!current) return cur; if (current.quantity <= 1) return cur.filter((row) => row.item_id !== item.id); return cur.map((row) => row.item_id === item.id ? { ...row, quantity: row.quantity - 1 } : row); })}>−</button><span className="w-6 text-center text-xs text-[#ffe8ca]">{selectedQty}</span><button type="button" className="saas-ghost-btn !h-7 !min-h-7 !px-2 !py-0" onClick={() => props.setSeizedRows((cur) => { const current = cur.find((row) => row.item_id === item.id); if (!current) return [...cur, { item_id: item.id, quantity: 1 }]; if (current.quantity >= Number(item.quantity)) return cur; return cur.map((row) => row.item_id === item.id ? { ...row, quantity: row.quantity + 1 } : row); })}>+</button></div></div>; })}</div><label className="text-xs text-[#efcdab]">Note (optionnelle)</label><textarea className="saas-input h-20" value={props.seizedNote} onChange={(e) => props.setSeizedNote(e.target.value)} /><button type="button" className="saas-primary-btn w-full" onClick={() => void props.submit()}>Valider braquage arrêté</button></div>;
}

function RotationSuggestions({ suggestions }: { suggestions: Suggestion[] }) { return <section><h3 className="text-base font-semibold text-[#fff1dd]">🔁 Suggestions</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{suggestions.map((block) => <article key={block.title} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3"><p className="font-semibold text-[#ffe8ca]">{block.icon} {block.title}</p><div className="mt-2 space-y-2">{block.names.map((entry) => <div key={`${block.title}-${entry.name}`} className="rounded-lg border border-white/10 bg-[#2f1d14]/55 p-2 text-xs text-[#efcdab]"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">{entry.name}</p><span className="rounded-full border border-amber-200/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-[#ffe8ca]">{entry.score} pts</span></div><p className="mt-1">{entry.reason}</p></div>)}</div></article>)}</div></section>; }

function RoleRanking({ title, icon, rows, role }: { title: string; icon: string; rows: RoleStats[]; role: RoleKey }) {
  const sorted = [...rows].filter((row) => role === 'braqueur' ? row.braqueur > 0 : role === 'plan_mule_recup' ? row.mule > 0 : row.hostage > 0).sort((a, b) => role === 'braqueur' ? b.braqueur - a.braqueur || b.braqueurMoney - a.braqueurMoney : role === 'plan_mule_recup' ? b.mule - a.mule || b.muleSuccess - a.muleSuccess : b.hostage - a.hostage);
  return <article><h3 className="text-base font-semibold text-[#fff1dd]">{icon} {title}</h3><div className="mt-3 space-y-2">{sorted.slice(0, 8).map((row, index) => <div key={`${role}-${row.memberId}`} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-xs text-[#efcdab]"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-[#ffe8ca]">#{index + 1} {row.name}</p><RoleBadge role={role} /></div>{role === 'braqueur' ? <p>Fois braqueur: {row.braqueur} · Argent: {formatUsd(row.braqueurMoney)} · Moyenne: {formatUsd(row.braqueur ? row.braqueurMoney / row.braqueur : 0)} · Dernière: {lastLabel(row.braqueurLast)}</p> : null}{role === 'plan_mule_recup' ? <p>Fois mule/récup: {row.mule} · Dernière: {lastLabel(row.muleLast)} · Réussite: {row.mule ? Math.round((row.muleSuccess / row.mule) * 100) : 0}%</p> : null}{role === 'otage_apporte' ? <p>Otages apportés: {row.hostage} · Dernière: {lastLabel(row.hostageLast)} · Participation totale: {row.total}</p> : null}</div>)}{sorted.length === 0 ? <p className="text-xs text-[#efcdab]">Aucune donnée.</p> : null}</div></article>;
}

function LegacyRanking({ rows, resources }: { rows: Array<{ name: string; total: number; fleeca: number; bijouterie: number; morgue: number; money: number; avg: number; last: string }>; resources: Array<{ name: string; qty: number }> }) { return <article><h3 className="text-base font-semibold text-[#fff1dd]">🏆 Classement semaine</h3><div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-xs text-[#efcdab]"><thead className="text-[#ffe8ca]"><tr><th className="px-2 py-1">Joueur</th><th className="px-2 py-1">Braquages</th><th className="px-2 py-1">Fleeca</th><th className="px-2 py-1">Bijouterie</th><th className="px-2 py-1">Morgue</th><th className="px-2 py-1">Argent total</th><th className="px-2 py-1">Moyenne</th><th className="px-2 py-1">Dernière</th></tr></thead><tbody>{rows.map((row, idx) => <tr key={`${row.name}-${idx}`} className="border-t border-white/10"><td className="px-2 py-1 text-[#ffe8ca]">{row.name}</td><td className="px-2 py-1">{row.total}</td><td className="px-2 py-1">{row.fleeca}</td><td className="px-2 py-1">{row.bijouterie}</td><td className="px-2 py-1">{row.morgue}</td><td className="px-2 py-1">{formatUsd(row.money)}</td><td className="px-2 py-1">{formatUsd(row.avg)}</td><td className="px-2 py-1">{new Date(row.last).toLocaleString('fr-FR')}</td></tr>)}</tbody></table></div>{resources.length > 0 ? <p className="mt-2 text-xs text-[#efcdab]">Ressources les plus consommées: {resources.map((row) => `${row.name} x${row.qty}`).join(' · ')}</p> : null}</article>; }

function HistoryCard({ run }: { run: Run }) { const success = isSuccess(run); return <article className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3 text-sm text-[#f1d2ad]"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-[#ffe8ca]">{success ? '✅' : '🚔'} {run.robbery_type.toUpperCase()} — {success ? formatUsd(run.money_amount) : `Perte ${formatUsd(Number(run.lost_money ?? 0))}`}</p><p className="text-xs">{run.user_name || 'Groupe'} · {new Date(run.created_at).toLocaleString('fr-FR')}</p></div><div className="flex flex-wrap gap-1">{(run.participants ?? []).map((entry, idx) => <RoleBadge key={`${run.id}-${entry.label}-${idx}`} role={entry.role} label={entry.label} />)}</div></div><p className="mt-2 text-xs">Ressources: {(run.consumed_items ?? []).map((entry) => `${entry.itemName} x${entry.required}`).join(' · ') || '—'}</p><p className="text-xs">Solde après: {run.money_after != null ? formatUsd(run.money_after) : '—'}</p>{run.note ? <p className="text-xs">Note: {run.note}</p> : null}</article>; }
function RoleBadge({ role, label }: { role?: string; label?: string }) { return <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#2f1d14]/70 px-2 py-1 text-[11px] text-[#ffe8ca]">{roleIcon(role)} {label ? `${label} · ` : ''}{roleLabel(role)}</span>; }
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) { return <article className="rounded-xl border border-white/10 bg-[#3f281b]/50 p-3"><p className="text-xs text-[#efcdab]">{icon} {label}</p><p className="mt-1 text-lg font-semibold text-[#ffe8ca]">{value}</p></article>; }
