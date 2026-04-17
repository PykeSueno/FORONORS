'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { formatUsd } from '@/lib/currency';

type Member = { id: string; name: string; username: string };
type Item = { id: number; name: string; image_url: string | null; quantity: number };

type Transfo = {
  id: number;
  transfo_type: 'coke' | 'meth';
  target_group: string | null;
  quantity_sent: number;
  quantity_expected: number;
  quantity_received: number | null;
  status: 'pending' | 'received' | 'canceled';
  sent_at: string;
  created_by: string | null;
  paid_amount?: number | null;
  compensation_amount?: number | null;
  note?: string | null;
  source_item_name?: string | null;
  target_item_name?: string | null;
  source_stock_before?: number | null;
  source_stock_after_send?: number | null;
  source_stock_after_cancel?: number | null;
  target_stock_before?: number | null;
  target_stock_after_receive?: number | null;
  cash_before_compensation?: number | null;
  cash_after_compensation?: number | null;
};

type Sale = {
  id: number;
  drug_type: 'coke' | 'meth' | 'fentanyl';
  quantity_sold: number;
  member_labels: string[];
  is_group_sale: boolean;
  estimated_min: number;
  estimated_max: number;
  estimated_avg: number;
  actual_amount: number;
  created_at: string;
  item_name?: string | null;
  item_image_url?: string | null;
  stock_before?: number | null;
  stock_after?: number | null;
  cash_before?: number | null;
  cash_after?: number | null;
  sale_lines?: Array<{ itemName: string; itemImageUrl: string | null; quantity: number; estimatedMin: number; estimatedMax: number; estimatedAvg: number; actualAmount: number; stockBefore: number; stockAfter: number }>;
};
type Production = { id: number; production_type: 'coke' | 'meth'; input_snapshot: Record<string, unknown>; output_snapshot: Record<string, unknown>; note?: string | null; created_at: string };

type Tab = 'transfo' | 'sales' | 'production';

type DrugDef = {
  key: 'coke' | 'meth' | 'fentanyl';
  label: string;
  description: string;
  itemKeyword: string;
  unitPrice: { min: number; max: number };
};

const DRUG_DEFS: DrugDef[] = [
  { key: 'coke', label: 'Pochon de Coke', description: 'Vente premium, marge stable', itemKeyword: 'pochon de coke', unitPrice: { min: 75, max: 85 } },
  { key: 'meth', label: 'Pochon de Meth', description: 'Valeur élevée, prix dynamique', itemKeyword: 'pochon de meth', unitPrice: { min: 120, max: 140 } },
  { key: 'fentanyl', label: 'Fentanyl', description: 'Flux rapide, marge moyenne', itemKeyword: 'fentanyl', unitPrice: { min: 60, max: 75 } }
];

const TRANSFO_DEFS = [
  {
    key: 'coke' as const,
    transfoLabel: 'Transfo Coke',
    sourceLabel: 'Feuille de Coke',
    sourceKeyword: 'feuille de coke',
    sourceHint: '1 feuille = 9.5 pochons (arrondi inférieur)',
    targetLabel: 'Pochon de Coke',
    targetKeyword: 'pochon de coke',
    calc: (qty: number) => Math.floor(qty * 9.5)
  },
  {
    key: 'meth' as const,
    transfoLabel: 'Transfo Meth',
    sourceLabel: 'Meth brut',
    sourceKeyword: 'meth brut',
    sourceHint: '1 meth brut = 2 pochons de meth',
    targetLabel: 'Pochon de Meth',
    targetKeyword: 'pochon de meth',
    calc: (qty: number) => qty * 2
  }
];

function statusVisual(status: Transfo['status']) {
  if (status === 'received') return { label: 'Reçu', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/40' };
  if (status === 'canceled') return { label: 'Annulé', cls: 'bg-rose-500/15 text-rose-100 border-rose-300/40' };
  return { label: 'En attente', cls: 'bg-amber-500/15 text-amber-100 border-amber-300/40' };
}

export function DrugsPageClient({
  currentUserId,
  transfos,
  sales,
  productions,
  members,
  items,
  canTransfoView,
  canTransfoCreate,
  canTransfoReceiveValidate,
  canTransfoCancelOwn,
  canTransfoCancelAny,
  canTransfoEditOwn,
  canTransfoEditAny,
  canSalesView,
  canSalesCreate,
  canProductionAccess,
  canProductionCreate,
  canProductionCokeCreate,
  canProductionMethCreate,
  canProductionHistoryView
}: {
  currentUserId: string;
  transfos: Transfo[];
  sales: Sale[];
  productions: Production[];
  members: Member[];
  items: Item[];
  canTransfoView: boolean;
  canTransfoCreate: boolean;
  canTransfoReceiveValidate: boolean;
  canTransfoCancelOwn: boolean;
  canTransfoCancelAny: boolean;
  canTransfoEditOwn: boolean;
  canTransfoEditAny: boolean;
  canSalesView: boolean;
  canSalesCreate: boolean;
  canProductionAccess: boolean;
  canProductionCreate: boolean;
  canProductionCokeCreate: boolean;
  canProductionMethCreate: boolean;
  canProductionHistoryView: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('transfo');
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const itemByKeyword = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/[’]/g, '\'').trim();
    return (keyword: string) => {
      const normalizedKeyword = normalize(keyword);
      return items.find((entry) => normalize(entry.name).includes(normalizedKeyword)) ?? null;
    };
  }, [items]);

  const itemByExactName = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/[’]/g, '\'').trim();
    return (name: string) => items.find((entry) => normalize(entry.name) === normalize(name)) ?? null;
  }, [items]);

  const [transfoType, setTransfoType] = useState<'coke' | 'meth'>('coke');
  const [targetGroup, setTargetGroup] = useState('');
  const [quantitySent, setQuantitySent] = useState(100);
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState('');
  const [manageTransfo, setManageTransfo] = useState<Transfo | null>(null);
  const [validateTransfo, setValidateTransfo] = useState<Transfo | null>(null);
  const [manageQtyReceived, setManageQtyReceived] = useState(0);
  const [manageCompensation, setManageCompensation] = useState(0);
  const [manageQuantitySent, setManageQuantitySent] = useState(1);
  const [manageTargetGroup, setManageTargetGroup] = useState('');
  const [managePaidAmount, setManagePaidAmount] = useState(0);
  const [manageNote, setManageNote] = useState('');

  const [saleLines, setSaleLines] = useState<Array<{ id: number; drug_type: 'coke' | 'meth' | 'fentanyl'; quantity_sold: number; actual_amount: number }>>([{ id: 1, drug_type: 'coke', quantity_sold: 10, actual_amount: 0 }]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [cokeSeeds, setCokeSeeds] = useState(9);
  const [cokeZones, setCokeZones] = useState(1);
  const [cokeHarvest, setCokeHarvest] = useState(9);
  const [methMachines, setMethMachines] = useState(3);
  const [methHarvest, setMethHarvest] = useState(30);
  const [prodNote, setProdNote] = useState('');
  const [productionMode, setProductionMode] = useState<'coke' | 'meth'>('coke');

  const selectedTransfoDef = useMemo(() => TRANSFO_DEFS.find((entry) => entry.key === transfoType) ?? TRANSFO_DEFS[0], [transfoType]);
  const sourceItem = itemByKeyword(selectedTransfoDef.sourceKeyword);
  const targetItem = itemByKeyword(selectedTransfoDef.targetKeyword);
  const transfoExpected = selectedTransfoDef.calc(quantitySent);
  const sourceStock = Number(sourceItem?.quantity ?? 0);
  const stockAfterSend = Math.max(0, sourceStock - quantitySent);

  const saleRows = useMemo(() => saleLines.map((line) => {
    const def = DRUG_DEFS.find((entry) => entry.key === line.drug_type) ?? DRUG_DEFS[0];
    const item = itemByKeyword(def.itemKeyword);
    const min = line.quantity_sold * def.unitPrice.min;
    const max = line.quantity_sold * def.unitPrice.max;
    const avg = Math.round((min + max) / 2);
    return { ...line, def, item, stock: Number(item?.quantity ?? 0), estimate: { min, max, avg } };
  }), [saleLines, itemByKeyword]);
  const saleTotals = useMemo(() => ({
    min: saleRows.reduce((sum, row) => sum + row.estimate.min, 0),
    max: saleRows.reduce((sum, row) => sum + row.estimate.max, 0),
    avg: saleRows.reduce((sum, row) => sum + row.estimate.avg, 0),
    actual: saleRows.reduce((sum, row) => sum + (row.actual_amount > 0 ? row.actual_amount : row.estimate.avg), 0)
  }), [saleRows]);
  const visibleTransfos = useMemo(() => transfos.filter((entry) => !(entry.id === 1 && entry.transfo_type === 'meth' && !entry.source_item_name)), [transfos]);

  const safeCokeSeeds = Number.isFinite(cokeSeeds) ? Math.max(0, cokeSeeds) : 0;
  const safeCokeZones = Number.isFinite(cokeZones) ? Math.max(0, cokeZones) : 0;
  const safeCokeHarvest = Number.isFinite(cokeHarvest) ? Math.max(0, cokeHarvest) : 0;
  const safeMethMachines = Number.isFinite(methMachines) ? Math.max(0, methMachines) : 0;
  const safeMethHarvest = Number.isFinite(methHarvest) ? Math.max(0, methHarvest) : 0;

  const cokeNeed = useMemo(() => ({ pots: safeCokeSeeds, fert: safeCokeSeeds, water: safeCokeSeeds * 3, uv: safeCokeZones * 2, leavesTheo: safeCokeSeeds }), [safeCokeSeeds, safeCokeZones]);
  const methNeed = useMemo(() => ({ tables: safeMethMachines, machines: safeMethMachines, batteries: safeMethMachines * 2, ammoniaque: safeMethMachines * 6, methylamine: safeMethMachines * 5, theoMin: safeMethMachines * 10, theoMax: safeMethMachines * 20 }), [safeMethMachines]);

  const productionItems = useMemo(() => ({
    cokeSeeds: itemByKeyword('graine de coke'),
    cokePots: itemByKeyword('pot'),
    cokeFert: itemByKeyword('fertilisant'),
    cokeWater: itemByExactName("Bouteille d'Eau") ?? itemByKeyword("bouteille d'eau"),
    cokeUv: itemByKeyword('lampe uv'),
    cokeLeaves: itemByKeyword('feuille de coke'),
    methTable: itemByKeyword('table'),
    methMachine: itemByKeyword('machine de meth'),
    methBattery: itemByKeyword('batterie'),
    methAmmonia: itemByKeyword('ammoniaque'),
    methMethylamine: itemByKeyword('methylamine'),
    methRaw: itemByKeyword('meth brut')
  }), [itemByExactName, itemByKeyword]);

  const transfoTitleById = useMemo(() => {
    const counters = new Map<string, number>();
    const labels = new Map<number, string>();
    const ordered = [...visibleTransfos].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime() || a.id - b.id);
    for (const entry of ordered) {
      const drugLabel = entry.transfo_type === 'coke' ? 'Coke' : 'Meth';
      const groupLabel = entry.target_group?.trim() || 'Groupe';
      const key = `${entry.transfo_type}::${groupLabel.toLowerCase()}`;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      labels.set(entry.id, `${drugLabel} - ${groupLabel} #${next}`);
    }
    return labels;
  }, [visibleTransfos]);

  function openManage(entry: Transfo) {
    setManageTransfo(entry);
    setValidateTransfo(null);
    setManageQtyReceived(Math.max(0, Number(entry.quantity_expected ?? 0)));
    setManageCompensation(0);
    setManageQuantitySent(Math.max(1, Number(entry.quantity_sent ?? 1)));
    setManageTargetGroup(entry.target_group ?? '');
    setManagePaidAmount(Math.max(0, Number(entry.paid_amount ?? 0)));
    setManageNote(entry.note ?? '');
    setError('');
  }

  function openValidate(entry: Transfo) {
    setValidateTransfo(entry);
    setManageTransfo(null);
    setManageQtyReceived(Math.max(0, Number(entry.quantity_expected ?? 0)));
    setManageCompensation(0);
    setError('');
  }

  function canManageTransfo(entry: Transfo) {
    if (entry.status !== 'pending') return false;
    if (canTransfoEditAny || canTransfoCancelAny) return true;
    if (entry.created_by === currentUserId && (canTransfoEditOwn || canTransfoCancelOwn)) return true;
    if (canTransfoReceiveValidate) return true;
    return false;
  }

  function syncView() {
    setIsSyncing(true);
    router.refresh();
    setTimeout(() => setIsSyncing(false), 800);
  }

  async function createTransfo() {
    if (!sourceItem || !targetItem) {
      setError('Item de transfo introuvable dans le stock. Vérifie les noms des items.');
      return;
    }
    const response = await fetch('/api/drugs/transfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transfo_type: transfoType,
        target_group: targetGroup,
        quantity_sent: quantitySent,
        paid_amount: paidAmount,
        note
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Création transfo impossible.');
      return;
    }
    syncView();
  }

  async function updateTransfo() {
    if (!manageTransfo) return;
    const response = await fetch('/api/drugs/transfo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transfo_id: manageTransfo.id,
        action: 'edit',
        quantity_sent: manageQuantitySent,
        target_group: manageTargetGroup,
        paid_amount: managePaidAmount,
        note: manageNote
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Modification impossible.');
      return;
    }
    syncView();
  }

  async function cancelTransfo() {
    if (!manageTransfo) return;
    const response = await fetch('/api/drugs/transfo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfo_id: manageTransfo.id, action: 'cancel' })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Annulation impossible.');
      return;
    }
    syncView();
  }

  async function validateReception() {
    if (!validateTransfo) return;
    const response = await fetch('/api/drugs/transfo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transfo_id: validateTransfo.id,
        action: 'validate_receive',
        quantity_received: manageQtyReceived,
        compensation_amount: manageCompensation
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Validation réception impossible.');
      return;
    }
    syncView();
  }

  async function createSale() {
    if (saleRows.some((row) => !row.item)) {
      setError('Au moins une drogue sélectionnée est introuvable dans le stock.');
      return;
    }
    const selected = members.filter((member) => selectedMembers.includes(member.id));
    const labels = selected.map((member) => member.name || member.username);

    const response = await fetch('/api/drugs/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: saleRows.map((row) => ({ drug_type: row.drug_type, quantity_sold: row.quantity_sold, actual_amount: row.actual_amount })),
        is_group_sale: labels.length === 0,
        member_user_ids: selectedMembers,
        member_labels: labels,
        actual_amount: saleTotals.actual
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Création vente impossible.');
      return;
    }
    syncView();
  }

  async function validateProduction(type: 'coke' | 'meth') {
    const payload = type === 'coke'
      ? { production_type: 'coke', seeds_count: safeCokeSeeds, zones_count: safeCokeZones, harvested_leaves: safeCokeHarvest, note: prodNote }
      : { production_type: 'meth', meth_machines_count: safeMethMachines, harvested_meth_raw: safeMethHarvest, note: prodNote };
    const response = await fetch('/api/drugs/production', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Validation production impossible.');
      return;
    }
    syncView();
  }

  return (
    <div className="space-y-4">
      <section className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex gap-2">
          <button className={`filter-pill ${tab === 'transfo' ? 'filter-pill-active' : ''}`} onClick={() => setTab('transfo')}>🧪 Transfo</button>
          <button className={`filter-pill ${tab === 'sales' ? 'filter-pill-active' : ''}`} onClick={() => setTab('sales')}>💸 Vente drogue</button>
          {(canProductionAccess || canProductionHistoryView) ? <button className={`filter-pill ${tab === 'production' ? 'filter-pill-active' : ''}`} onClick={() => setTab('production')}>🏭 Production</button> : null}
        </div>
        <p className="text-xs text-[#f1d2ad]">Module détaillé — stock, argent, membres, logs {isSyncing ? '· synchronisation…' : ''}</p>
      </section>

      {tab === 'transfo' ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          {canTransfoCreate ? (
            <article className="glass-card space-y-4 p-5">
              <h3 className="text-lg font-semibold text-[#fff1dd]">Nouvelle transfo</h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {TRANSFO_DEFS.map((def) => {
                  const defItem = itemByKeyword(def.sourceKeyword);
                  const active = transfoType === def.key;
                  return (
                    <button
                      key={def.key}
                      className={`rounded-2xl border p-3 text-left transition ${active ? 'border-[#f7d6ad] bg-[#6e472b]/55 shadow-[0_0_0_1px_rgba(247,214,173,0.4)]' : 'border-white/10 bg-[#2f1d14]/50 hover:border-white/25'}`}
                      onClick={() => setTransfoType(def.key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-[#22140e]">
                          {defItem?.image_url ? <Image src={defItem.image_url} alt={def.sourceLabel} width={56} height={56} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-2xl">📦</div>}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#ffe9cd]">{def.sourceLabel}</p>
                          <p className="text-xs text-[#efcdab]">{def.sourceHint}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-[#2f1d14]/45 p-4">
                <Field label="1. Type de transfo" hint="Item envoyé + stock actuel">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                    <ItemThumb item={sourceItem} fallback="📤" />
                    <div className="min-w-[160px] flex-1">
                      <p className="text-sm font-semibold text-[#ffe9cd]">{selectedTransfoDef.sourceLabel}</p>
                      <p className="text-xs text-[#efcdab]">Stock actuel: {sourceStock}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-[#efcdab]">Quantité envoyée</p>
                      <input
                        className="saas-input w-28 text-center"
                        inputMode="numeric"
                        value={quantitySent}
                        onChange={(event) => setQuantitySent(Math.max(1, Number(event.target.value || 1)))}
                      />
                    </div>
                  </div>
                </Field>

                <Field label="2. Groupe destinataire" hint="Nom du groupe ou du contact">
                  <input className="saas-input w-full" placeholder="Ex: Crew Paleto" value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)} />
                </Field>

                <Field label="3. Argent payé au groupe" hint="Laisser 0 si non payé">
                  <input
                    className="saas-input w-full"
                    inputMode="decimal"
                    placeholder="Montant payé au groupe"
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(Math.max(0, Number(event.target.value || 0)))}
                  />
                </Field>

                <Field label="4. Note facultative" hint="Information complémentaire">
                  <textarea className="saas-input w-full" rows={2} placeholder="Note (facultatif)" value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
              </section>

              <section className="grid gap-2 rounded-2xl border border-white/10 bg-[#3b2518]/60 p-4 sm:grid-cols-5">
                <Metric label="Envoyé" value={String(quantitySent)} icon="📤" />
                <Metric label="Attendu" value={String(transfoExpected)} icon="🎯" />
                <Metric label="Stock avant" value={String(sourceStock)} icon="📦" />
                <Metric label="Stock après" value={String(stockAfterSend)} icon="📉" />
                <Metric label="Argent payé" value={formatUsd(paidAmount)} icon="💸" />
              </section>

              <button className="saas-primary-btn w-full" onClick={() => void createTransfo()}>Envoyer en transfo</button>
            </article>
          ) : (
            <article className="glass-card p-5 text-sm text-[#f2d2ad]">Tu n’as pas la permission de créer une transfo.</article>
          )}

          <article className="glass-card space-y-3 p-5">
            <h3 className="text-lg font-semibold text-[#fff1dd]">Transfos</h3>
            {!canTransfoView ? <p className="text-sm text-[#f1d2ad]">Permission manquante: voir les transfos.</p> : null}
            {canTransfoView ? (
              <div className="max-h-[980px] space-y-3 overflow-y-auto pr-1">
                {visibleTransfos.map((entry) => {
                  const def = TRANSFO_DEFS.find((it) => it.key === entry.transfo_type) ?? TRANSFO_DEFS[0];
                  const source = itemByKeyword(def.sourceKeyword);
                  const target = itemByKeyword(def.targetKeyword);
                  const status = statusVisual(entry.status);
                  return (
                    <article key={entry.id} className="rounded-2xl border border-white/10 bg-[#3f281b]/55 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-base font-semibold text-[#ffe8ca]">{transfoTitleById.get(entry.id) ?? `${def.transfoLabel} #${entry.id}`}</p>
                        <span className={`rounded-full border px-2 py-1 text-xs ${status.cls}`}>{status.label}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ItemThumb item={source} fallback="📤" sizeClass="h-14 w-14" />
                        <span className="text-[#efcdab]">→</span>
                        <ItemThumb item={target} fallback="📥" sizeClass="h-14 w-14" />
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-[#efcdab] sm:grid-cols-2">
                        <p>👥 Groupe: <span className="text-[#ffe9cd]">{entry.target_group || 'Non renseigné'}</span></p>
                        <p>📅 Date: <span className="text-[#ffe9cd]">{new Date(entry.sent_at).toLocaleString('fr-FR')}</span></p>
                        <p>📤 Envoyé: <span className="text-[#ffe9cd]">{entry.quantity_sent}</span></p>
                        <p>🎯 Attendu: <span className="text-[#ffe9cd]">{entry.quantity_expected}</span></p>
                        <p>📥 Reçu: <span className="text-[#ffe9cd]">{entry.quantity_received ?? 0}</span></p>
                        <p>🏷️ Statut: <span className="text-[#ffe9cd]">{status.label}</span></p>
                        <p>💸 Argent payé: <span className="text-[#ffe9cd]">{formatUsd(Number(entry.paid_amount ?? 0))}</span></p>
                        <p>💰 Compensation: <span className="text-[#ffe9cd]">{formatUsd(Number(entry.compensation_amount ?? 0))}</span></p>
                      </div>

                      {entry.note ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-[#2b1a12]/55 px-3 py-2 text-xs text-[#efcdab]">
                          Note: <span className="text-[#ffe9cd]">{entry.note}</span>
                        </div>
                      ) : null}

                      <div className="mt-3 flex justify-end gap-2">
                        {canManageTransfo(entry) ? <button className="saas-ghost-btn" onClick={() => openManage(entry)}>Gérer</button> : null}
                        {entry.status === 'pending' && canTransfoReceiveValidate ? <button className="saas-primary-btn !py-2 !px-3" onClick={() => openValidate(entry)}>Valider</button> : null}
                      </div>
                    </article>
                  );
                })}
                {visibleTransfos.length === 0 ? <p className="text-sm text-[#f1d2ad]">Aucune transfo pour le moment.</p> : null}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {tab === 'sales' ? (
        <section className="grid gap-4 xl:grid-cols-[1.08fr_1fr]">
          <article className="glass-card space-y-4 p-5">
            <h3 className="text-lg font-semibold text-[#fff1dd]">Nouvelle vente drogue</h3>

            <Field label="1. Sélection drogue (multi-lignes)" hint="Ajoute plusieurs drogues dans la même vente">
              <div className="space-y-3">
                {saleRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-white/10 bg-[#2f1d14]/45 p-3">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <div className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          {DRUG_DEFS.map((drug) => {
                            const item = itemByKeyword(drug.itemKeyword);
                            const active = row.drug_type === drug.key;
                            return (
                              <button
                                key={`${row.id}-${drug.key}`}
                                className={`rounded-xl border p-2 text-left ${active ? 'border-[#f7d6ad] bg-[#6e472b]/55' : 'border-white/10 bg-[#2b1a12]/50'}`}
                                onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, drug_type: drug.key } : line))}
                              >
                                <div className="flex items-center gap-2">
                                  <ItemThumb item={item} fallback="💊" />
                                  <div>
                                    <p className="text-xs font-semibold text-[#ffe9cd]">{drug.label}</p>
                                    <p className="text-[11px] text-[#efcdab]">Stock {item?.quantity ?? 0}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="space-y-1">
                          <p className="text-center text-xs text-[#efcdab]">Quantité vendue</p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                          <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, quantity_sold: Math.max(1, line.quantity_sold - 1) } : line))}>-1</button>
                          <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, quantity_sold: Math.max(1, line.quantity_sold - 10) } : line))}>-10</button>
                          <input className="saas-input w-24 text-center" value={row.quantity_sold} onChange={(event) => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, quantity_sold: Math.max(1, Number(event.target.value || 1)) } : line))} />
                          <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, quantity_sold: line.quantity_sold + 10 } : line))}>+10</button>
                          <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, quantity_sold: line.quantity_sold + 1 } : line))}>+1</button>
                          {saleLines.length > 1 ? <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.filter((line) => line.id !== row.id))}>Supprimer</button> : null}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Metric label="Est. min" value={formatUsd(row.estimate.min)} icon="📉" />
                          <Metric label="Est. max" value={formatUsd(row.estimate.max)} icon="📈" />
                          <Metric label="Est. moyenne" value={formatUsd(row.estimate.avg)} icon="🧮" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-center text-xs text-[#efcdab]">Argent réel récupéré</p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                          <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, actual_amount: Math.max(0, line.actual_amount - 100) } : line))}>-100</button>
                          <input className="saas-input w-28 text-center" value={row.actual_amount} onChange={(event) => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, actual_amount: Math.max(0, Number(event.target.value || 0)) } : line))} />
                          <button className="saas-ghost-btn !px-2 !py-1" onClick={() => setSaleLines((current) => current.map((line) => line.id === row.id ? { ...line, actual_amount: line.actual_amount + 100 } : line))}>+100</button>
                          </div>
                        </div>
                      </div>
                      <div />
                    </div>
                  </div>
                ))}
                <button className="saas-ghost-btn w-full" onClick={() => setSaleLines((current) => [...current, { id: Date.now() + current.length, drug_type: 'coke', quantity_sold: 1, actual_amount: 0 }])}>+ Ajouter une drogue</button>
              </div>
            </Field>

            <Field label="3. Membre(s) vendeur(s) ou Groupe" hint="Optionnel · Groupe par défaut">
              <div className="rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
                <div className="flex flex-wrap gap-2">
                  <button className={`filter-pill ${selectedMembers.length === 0 ? 'filter-pill-active' : ''}`} onClick={() => setSelectedMembers([])}>Groupe</button>
                  {members.map((member) => {
                    const selected = selectedMembers.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        className={`filter-pill ${selected ? 'filter-pill-active' : ''}`}
                        onClick={() => setSelectedMembers((current) => selected ? current.filter((id) => id !== member.id) : [...current, member.id])}
                      >
                        {member.name || member.username}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Field>

            <Field label="4. Estimation auto globale" hint="Mini / Maxi / Moyenne">
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Estimation mini" value={formatUsd(saleTotals.min)} icon="📉" />
                <Metric label="Estimation maxi" value={formatUsd(saleTotals.max)} icon="📈" />
                <Metric label="Estimation moyenne" value={formatUsd(saleTotals.avg)} icon="🧮" />
              </div>
            </Field>

            <Field label="6. Résumé avant validation" hint="Contrôle stock et cash">
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-[#3b2518]/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Lignes drogues" value={String(saleRows.length)} icon="🧷" />
                <Metric label="Qté vendue" value={String(saleRows.reduce((sum, row) => sum + row.quantity_sold, 0))} icon="📦" />
                <Metric label="Estimation moyenne" value={formatUsd(saleTotals.avg)} icon="🧮" />
                <Metric label="Réel récupéré" value={formatUsd(saleTotals.actual)} icon="💰" />
                <Metric label="Vendeurs" value={selectedMembers.length ? String(selectedMembers.length) : 'Groupe'} icon="👥" />
              </div>
            </Field>

            {canSalesCreate ? <button className="saas-primary-btn w-full" onClick={() => void createSale()}>Valider vente drogue</button> : <p className="text-sm text-[#f2d2ad]">Tu n’as pas la permission de créer une vente drogue.</p>}
          </article>

          <article className="glass-card space-y-3 p-5">
            <h3 className="text-lg font-semibold text-[#fff1dd]">Historique ventes drogue</h3>
            {!canSalesView ? <p className="text-sm text-[#f1d2ad]">Permission manquante: voir les ventes drogue.</p> : null}
            {canSalesView ? (
              <div className="max-h-[980px] space-y-3 overflow-y-auto pr-1">
                {sales.map((sale) => {
                  const saleItemRef = itemByKeyword((DRUG_DEFS.find((entry) => entry.key === sale.drug_type)?.itemKeyword ?? ''));
                  return (
                    <article key={sale.id} className="rounded-2xl border border-white/10 bg-[#3f281b]/55 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#ffe8ca]">💊 #{sale.id} · {sale.item_name || (DRUG_DEFS.find((entry) => entry.key === sale.drug_type)?.label ?? sale.drug_type)}</p>
                        <p className="text-xs text-[#efcdab]">{new Date(sale.created_at).toLocaleString('fr-FR')}</p>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <ItemThumb item={{ id: -1, name: sale.item_name ?? '', image_url: sale.item_image_url ?? saleItemRef?.image_url ?? null, quantity: 0 }} fallback="💊" />
                        <div className="text-xs text-[#efcdab]">
                          <p>👤 Vendeur(s): <span className="text-[#ffe9cd]">{sale.is_group_sale ? 'Groupe' : (sale.member_labels ?? []).join(' + ')}</span></p>
                          <p>📦 Quantité vendue: <span className="text-[#ffe9cd]">{sale.quantity_sold}</span></p>
                          <p>💰 Réel récupéré: <span className="text-[#ffe9cd]">{formatUsd(sale.actual_amount)}</span></p>
                          <p>🏦 Argent groupe: <span className="text-[#ffe9cd]">{typeof sale.cash_after === 'number' ? formatUsd(sale.cash_after) : '-'}</span></p>
                        </div>
                      </div>
                      {(sale.sale_lines ?? []).length > 0 ? <button className="saas-ghost-btn mt-3 !py-2 !px-3" onClick={() => setDetailSale(sale)}>Voir détail</button> : null}
                    </article>
                  );
                })}
                {sales.length === 0 ? <p className="text-sm text-[#f1d2ad]">Aucune vente drogue enregistrée.</p> : null}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {tab === 'production' ? (
        <section className="grid gap-4 xl:grid-cols-[1.08fr_1fr]">
          <article className="glass-card space-y-4 p-5">
            <h3 className="text-lg font-semibold text-[#fff1dd]">Production drogues</h3>
            {!canProductionAccess ? <p className="text-sm text-[#f1d2ad]">Permission manquante: accès production.</p> : null}
            {canProductionAccess ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className={`rounded-2xl border p-3 text-left ${productionMode === 'coke' ? 'border-[#f7d6ad] bg-[#6e472b]/55' : 'border-white/10 bg-[#2f1d14]/45'}`} onClick={() => setProductionMode('coke')}>
                    <div className="flex items-center gap-2">
                      <ItemThumb item={productionItems.cokeLeaves} fallback="🌿" />
                      <div><p className="text-sm font-semibold text-[#ffe9cd]">Mode Coke</p><p className="text-xs text-[#efcdab]">Production feuille de coke</p></div>
                    </div>
                  </button>
                  <button className={`rounded-2xl border p-3 text-left ${productionMode === 'meth' ? 'border-[#f7d6ad] bg-[#6e472b]/55' : 'border-white/10 bg-[#2f1d14]/45'}`} onClick={() => setProductionMode('meth')}>
                    <div className="flex items-center gap-2">
                      <ItemThumb item={productionItems.methRaw} fallback="⚗️" />
                      <div><p className="text-sm font-semibold text-[#ffe9cd]">Mode Meth</p><p className="text-xs text-[#efcdab]">Production meth brut</p></div>
                    </div>
                  </button>
                </div>

                {productionMode === 'coke' ? (
                  <section className="rounded-2xl border border-white/10 bg-[#2f1d14]/45 p-4">
                    <h4 className="text-sm font-semibold text-[#ffe9cd]">Production Coke</h4>
                    <p className="text-xs text-[#efcdab]">1 zone = 9 graines + 2 lampes UV · 1 graine = 1 feuille théorique.</p>
                    <p className="mt-2 text-xs font-semibold text-[#ffe9cd]">1) Input (quantités)</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <NumberField label="Nombre de zones" item={productionItems.cokeUv} fallback="🗺️" value={safeCokeZones} onMinus={() => setCokeZones((current) => Math.max(0, current - 1))} onPlus={() => setCokeZones((current) => current + 1)} onChange={(value) => setCokeZones(value)} />
                      <NumberField label="Nombre de graines" item={productionItems.cokeSeeds} fallback="🌱" value={safeCokeSeeds} onMinus={() => setCokeSeeds((current) => Math.max(0, current - 9))} onPlus={() => setCokeSeeds((current) => current + 9)} onChange={(value) => setCokeSeeds(value)} />
                      <NumberField label="Récolte réelle" item={productionItems.cokeLeaves} fallback="🌿" value={safeCokeHarvest} onMinus={() => setCokeHarvest((current) => Math.max(0, current - 1))} onPlus={() => setCokeHarvest((current) => current + 1)} onChange={(value) => setCokeHarvest(value)} />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-[#ffe9cd]">2) Calcul auto + stock actuel</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <RequirementCard label="Pots nécessaires" value={String(cokeNeed.pots)} item={productionItems.cokePots} fallback="🪴" />
                      <RequirementCard label="Fertilisants nécessaires" value={String(cokeNeed.fert)} item={productionItems.cokeFert} fallback="🧪" />
                      <RequirementCard label="Bouteilles d’eau nécessaires" value={String(cokeNeed.water)} item={productionItems.cokeWater} fallback="💧" />
                      <RequirementCard label="Lampes UV nécessaires" value={String(cokeNeed.uv)} item={productionItems.cokeUv} fallback="💡" />
                      <RequirementCard label="Récolte théorique" value={String(cokeNeed.leavesTheo)} item={productionItems.cokeLeaves} fallback="🌿" />
                    </div>
                    {(canProductionCreate || canProductionCokeCreate) ? <button className="saas-primary-btn mt-3 w-full" onClick={() => void validateProduction('coke')}>Valider production Coke</button> : <p className="mt-3 text-sm text-[#f2d2ad]">Permission manquante: valider production Coke.</p>}
                  </section>
                ) : (
                  <section className="rounded-2xl border border-white/10 bg-[#2f1d14]/45 p-4">
                    <h4 className="text-sm font-semibold text-[#ffe9cd]">Production Meth</h4>
                    <p className="text-xs text-[#efcdab]">1 cycle = 1 table + 1 machine + 2 batteries + 6 ammoniaques + 5 methylamines.</p>
                    <p className="text-xs text-[#efcdab]">1 table donne environ 10 à 20 meth brut.</p>
                    <p className="mt-2 text-xs font-semibold text-[#ffe9cd]">1) Input (quantités)</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <NumberField label="Nombre de cycles / machines" item={productionItems.methMachine} fallback="⚙️" value={safeMethMachines} onMinus={() => setMethMachines((current) => Math.max(0, current - 1))} onPlus={() => setMethMachines((current) => current + 1)} onChange={(value) => setMethMachines(value)} />
                      <NumberField label="Récolte réelle" item={productionItems.methRaw} fallback="📦" value={safeMethHarvest} onMinus={() => setMethHarvest((current) => Math.max(0, current - 1))} onPlus={() => setMethHarvest((current) => current + 1)} onChange={(value) => setMethHarvest(value)} />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-[#ffe9cd]">2) Calcul auto + stock actuel</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <RequirementCard label="Tables nécessaires" value={String(methNeed.tables)} item={productionItems.methTable} fallback="🧱" />
                      <RequirementCard label="Machines nécessaires" value={String(methNeed.machines)} item={productionItems.methMachine} fallback="⚙️" />
                      <RequirementCard label="Batteries nécessaires" value={String(methNeed.batteries)} item={productionItems.methBattery} fallback="🔋" />
                      <RequirementCard label="Ammoniaque nécessaire" value={String(methNeed.ammoniaque)} item={productionItems.methAmmonia} fallback="🧴" />
                      <RequirementCard label="Methylamine nécessaire" value={String(methNeed.methylamine)} item={productionItems.methMethylamine} fallback="🧪" />
                      <RequirementCard label="Récolte théorique" value={`${methNeed.theoMin}-${methNeed.theoMax}`} item={productionItems.methRaw} fallback="📈" />
                    </div>
                    {(canProductionCreate || canProductionMethCreate) ? <button className="saas-primary-btn mt-3 w-full" onClick={() => void validateProduction('meth')}>Valider production Meth</button> : <p className="mt-3 text-sm text-[#f2d2ad]">Permission manquante: valider production Meth.</p>}
                  </section>
                )}

                <Field label="Note production (facultative)" hint="Ajoutée à la validation Coke ou Meth">
                  <textarea className="saas-input w-full" rows={2} placeholder="Note production" value={prodNote} onChange={(event) => setProdNote(event.target.value)} />
                </Field>
              </div>
            ) : null}
          </article>

          <article className="glass-card space-y-3 p-5">
            <h3 className="text-lg font-semibold text-[#fff1dd]">Historique productions</h3>
            {!canProductionHistoryView ? <p className="text-sm text-[#f1d2ad]">Permission manquante: voir les productions.</p> : null}
            {canProductionHistoryView ? (
              <div className="max-h-[980px] space-y-3 overflow-y-auto pr-1">
                {productions.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-white/10 bg-[#3f281b]/55 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#ffe8ca]">#{entry.id} · {entry.production_type === 'coke' ? 'Production Coke' : 'Production Meth'}</p>
                      <p className="text-xs text-[#efcdab]">{new Date(entry.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {entry.production_type === 'coke' ? (
                        <>
                          <RequirementCard label="Graines" value={String(Number((entry.input_snapshot?.seeds as number) ?? 0))} item={productionItems.cokeSeeds} fallback="🌱" />
                          <RequirementCard label="Récolte réelle" value={String(Number((entry.output_snapshot?.harvestedLeaves as number) ?? 0))} item={productionItems.cokeLeaves} fallback="🌿" />
                        </>
                      ) : (
                        <>
                          <RequirementCard label="Cycles / machines" value={String(Number((entry.input_snapshot?.machineCount as number) ?? 0))} item={productionItems.methMachine} fallback="⚙️" />
                          <RequirementCard label="Récolte réelle" value={String(Number((entry.output_snapshot?.methRawReal as number) ?? 0))} item={productionItems.methRaw} fallback="📦" />
                        </>
                      )}
                    </div>
                    {entry.note ? <p className="mt-2 text-xs text-[#efcdab]">Note: {entry.note}</p> : null}
                  </article>
                ))}
                {productions.length === 0 ? <p className="text-sm text-[#f1d2ad]">Aucune production pour le moment.</p> : null}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Repères stock drogues</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {items.filter((item) => /coke|meth|fentanyl/i.test(item.name)).slice(0, 12).map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <div className="flex items-center gap-2">
                <ItemThumb item={item} fallback="📦" />
                <div>
                  <p className="text-sm text-[#ffe8ca]">{item.name}</p>
                  <p className="text-xs text-[#efcdab]">Stock {item.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {manageTransfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[#fff1dd]">Gérer transfo #{manageTransfo.id}</h3>
              <button className="saas-ghost-btn" onClick={() => setManageTransfo(null)}>Fermer</button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Metric label="Type" value={manageTransfo.transfo_type === 'coke' ? 'Coke' : 'Meth'} icon="🧪" />
              <Metric label="Statut" value={statusVisual(manageTransfo.status).label} icon="🏷️" />
              <Metric label="Envoyé" value={String(manageTransfo.quantity_sent)} icon="📤" />
              <Metric label="Attendu" value={String(manageTransfo.quantity_expected)} icon="🎯" />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
              <ItemThumb item={itemByKeyword(manageTransfo.transfo_type === 'coke' ? 'feuille de coke' : 'meth brut')} fallback="📤" />
              <span className="text-[#efcdab]">→</span>
              <ItemThumb item={itemByKeyword(manageTransfo.transfo_type === 'coke' ? 'pochon de coke' : 'pochon de meth')} fallback="📥" />
              <p className="text-xs text-[#efcdab]">Envoi / Réception</p>
            </div>

            {manageTransfo.status === 'pending' ? (
              <div className="mt-4 space-y-4">
                {(canTransfoEditAny || (canTransfoEditOwn && manageTransfo.created_by === currentUserId)) ? (
                  <section className="rounded-2xl border border-white/10 bg-[#2f1d14]/45 p-4">
                    <h4 className="text-sm font-semibold text-[#ffe9cd]">Modifier la transfo</h4>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input className="saas-input" placeholder="Groupe destinataire" value={manageTargetGroup} onChange={(event) => setManageTargetGroup(event.target.value)} />
                      <input className="saas-input" inputMode="numeric" value={manageQuantitySent} onChange={(event) => setManageQuantitySent(Math.max(1, Number(event.target.value || 1)))} />
                      <input className="saas-input" inputMode="decimal" placeholder="Argent payé au groupe" value={managePaidAmount} onChange={(event) => setManagePaidAmount(Math.max(0, Number(event.target.value || 0)))} />
                      <input className="saas-input" placeholder="Note" value={manageNote} onChange={(event) => setManageNote(event.target.value)} />
                    </div>
                    <button className="saas-primary-btn mt-3 w-full" onClick={() => void updateTransfo()}>Enregistrer modifications</button>
                  </section>
                ) : null}

                {(canTransfoCancelAny || (canTransfoCancelOwn && manageTransfo.created_by === currentUserId)) ? (
                  <button className="saas-ghost-btn w-full" onClick={() => void cancelTransfo()}>Annuler la transfo</button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#f2d2ad]">Cette transfo est clôturée, aucune action possible.</p>
            )}
          </section>
        </div>
      ) : null}

      {validateTransfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[#fff1dd]">Valider la réception · transfo #{validateTransfo.id}</h3>
              <button className="saas-ghost-btn" onClick={() => setValidateTransfo(null)}>Fermer</button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Metric label="Groupe destinataire" value={validateTransfo.target_group || '—'} icon="👥" />
              <Metric label="Statut" value={statusVisual(validateTransfo.status).label} icon="🏷️" />
              <Metric label="Quantité envoyée" value={String(validateTransfo.quantity_sent)} icon="📤" />
              <Metric label="Quantité attendue" value={String(validateTransfo.quantity_expected)} icon="🎯" />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
              <ItemThumb item={itemByKeyword(validateTransfo.transfo_type === 'coke' ? 'feuille de coke' : 'meth brut')} fallback="📤" />
              <span className="text-[#efcdab]">→</span>
              <ItemThumb item={itemByKeyword(validateTransfo.transfo_type === 'coke' ? 'pochon de coke' : 'pochon de meth')} fallback="📥" />
              <p className="text-xs text-[#efcdab]">Item envoyé / item reçu</p>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#2f1d14]/45 p-4">
              <p className="text-sm font-semibold text-[#ffe9cd]">Validation réception</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input className="saas-input" inputMode="numeric" placeholder="Quantité réelle reçue" value={manageQtyReceived} onChange={(event) => setManageQtyReceived(Math.max(0, Number(event.target.value || 0)))} />
                <input className="saas-input" inputMode="decimal" placeholder="Compensation argent (optionnel)" value={manageCompensation} onChange={(event) => setManageCompensation(Math.max(0, Number(event.target.value || 0)))} />
              </div>
              <button className="saas-primary-btn mt-3 w-full" onClick={() => void validateReception()}>Valider la réception</button>
            </div>
          </section>
        </div>
      ) : null}

      {detailSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[#fff1dd]">Détail vente #{detailSale.id}</h3>
              <button className="saas-ghost-btn" onClick={() => setDetailSale(null)}>Fermer</button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-[#efcdab]">
              <p>👤 Vendeur(s): <span className="text-[#ffe9cd]">{detailSale.is_group_sale ? 'Groupe' : (detailSale.member_labels ?? []).join(' + ')}</span></p>
              <p>💰 Montant réel: <span className="text-[#ffe9cd]">{formatUsd(detailSale.actual_amount)}</span></p>
              <p>🏦 Argent groupe: <span className="text-[#ffe9cd]">{typeof detailSale.cash_before === 'number' ? formatUsd(detailSale.cash_before) : '-'} → {typeof detailSale.cash_after === 'number' ? formatUsd(detailSale.cash_after) : '-'}</span></p>
            </div>
            {(detailSale.sale_lines ?? []).length > 0 ? (
              <div className="mt-3 space-y-2">
                {(detailSale.sale_lines ?? []).map((line, idx) => (
                  <article key={`${detailSale.id}-${idx}`} className="rounded-xl border border-white/10 bg-[#2b1a12]/50 p-3 text-xs text-[#efcdab]">
                    <div className="flex items-center gap-2">
                      <ItemThumb item={{ id: -1, name: line.itemName, image_url: line.itemImageUrl ?? null, quantity: 0 }} fallback="💊" />
                      <p className="text-[#ffe9cd]">💊 {line.itemName}</p>
                    </div>
                    <p>📦 Quantité {line.quantity} · 💰 Réel {formatUsd(line.actualAmount)}</p>
                    <p>📉 Min {formatUsd(line.estimatedMin)} · 📈 Max {formatUsd(line.estimatedMax)} · 🧮 Moyenne {formatUsd(line.estimatedAvg)}</p>
                    <p>📦 Stock {line.stockBefore} → {line.stockAfter}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-[#ffe9cd]">{label}</p>
      {hint ? <p className="mb-1 text-xs text-[#efcdab]">{hint}</p> : null}
      {children}
    </div>
  );
}

function NumberField({
  label,
  item,
  fallback,
  value,
  onMinus,
  onPlus,
  onChange
}: {
  label: string;
  item: Item | null;
  fallback: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
      <div className="flex items-center gap-2">
        <ItemThumb item={item} fallback={fallback} />
        <p className="text-xs text-[#efcdab]">{label}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button className="saas-ghost-btn !px-2 !py-1" onClick={onMinus}>-</button>
        <input
          className="saas-input w-20 text-center"
          inputMode="numeric"
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value || 0);
            onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
          }}
        />
        <button className="saas-ghost-btn !px-2 !py-1" onClick={onPlus}>+</button>
      </div>
    </div>
  );
}

function RequirementCard({ label, value, item, fallback }: { label: string; value: string; item: Item | null; fallback: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#342116]/60 p-3">
      <div className="flex items-center gap-2">
        <ItemThumb item={item} fallback={fallback} />
        <div>
          <p className="text-xs text-[#efcdab]">{label}</p>
          <p className="text-sm font-semibold text-[#ffe8ca]">{value || '0'}</p>
          <p className="text-[11px] text-[#d3b590]">Stock actuel: {Math.max(0, Number(item?.quantity ?? 0))}</p>
        </div>
      </div>
    </div>
  );
}

function ItemThumb({ item, fallback, sizeClass = 'h-12 w-12' }: { item: Item | null; fallback: string; sizeClass?: string }) {
  return (
    <div className={`${sizeClass} overflow-hidden rounded-xl border border-white/10 bg-[#22140e]`}>
      {item?.image_url ? <Image src={item.image_url} alt={item.name} width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xl">{fallback}</div>}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
      <p className="text-xs text-[#efcdab]">{icon} {label}</p>
      <p className="text-sm font-semibold text-[#ffe8ca]">{value}</p>
    </div>
  );
}
