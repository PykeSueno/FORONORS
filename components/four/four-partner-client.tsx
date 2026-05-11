'use client';

import Image from 'next/image';
import { type ReactNode, useMemo, useState } from 'react';

import { formatUsd } from '@/lib/currency';
import {
  type FourPartnerConfig,
  getFourPartnerCycleDay,
  getFourPartnerPreview,
  getNextOffDay,
  getNextPartnerDay,
  toDateKey,
} from '@/lib/four-partner';

type Item = {
  id: number;
  name: string;
  quantity: number;
  category_key?: string | null;
  type_key?: string | null;
  image_url?: string | null;
};

export type FourPartnerSale = {
  id: number;
  sale_date: string;
  partner_name: string;
  kits_sold: number;
  cutters_sold: number;
  amount_received: number;
  payment_method: 'cash' | 'bank';
  status: 'validated' | 'bank_pending' | 'bank_received' | 'canceled';
  reported_items?: Array<{
    item_id: number;
    item_name: string;
    quantity: number;
    image_url?: string | null;
    before?: number;
    after?: number;
  }>;
  stock_snapshot?: {
    kits?: { item_id: number; item_name: string; before: number; after: number; sold: number };
    cutters?: { item_id: number; item_name: string; before: number; after: number; sold: number };
  };
  cash_before?: number | null;
  cash_after?: number | null;
  created_at?: string | null;
};

type ReportedDraft = {
  item_id: number;
  quantity: number;
};

type PartnerClientProps = {
  config: FourPartnerConfig;
  items: Item[];
  sales: FourPartnerSale[];
  canConfig: boolean;
  canSell: boolean;
  canHistory: boolean;
  canStats: boolean;
};

const CARD_CLASS =
  'glass-card h-full rounded-2xl border border-white/10 bg-[#4a2f20]/70 p-4 shadow-sm shadow-black/10 md:p-5';

const INPUT_CLASS =
  'w-full rounded-xl border border-white/10 bg-[#2b1a12]/70 px-3 py-2 text-sm text-[#fff1dd] outline-none transition focus:border-[#f2cc9b]/70 focus:ring-2 focus:ring-[#f2cc9b]/15';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Toutes categories',
  objects: 'Objets',
  equipment: 'Equipement',
  drugs: 'Produits',
  misc: 'Divers',
};

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function statusLabel(status: FourPartnerSale['status']) {
  if (status === 'bank_pending') return 'Bank en attente';
  if (status === 'bank_received') return 'Recu bank';
  if (status === 'canceled') return 'Annule';
  return 'Valide';
}

function statusTone(status: FourPartnerSale['status']) {
  if (status === 'bank_pending') return 'border-amber-300/40 bg-amber-500/10 text-amber-100';
  if (status === 'bank_received') return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100';
  if (status === 'canceled') return 'border-red-300/40 bg-red-100 text-red-900';
  return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100';
}

function categoryLabel(value: string) {
  return CATEGORY_LABELS[value] ?? value;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${value}T12:00:00`));
}

export function FourPartnerClient({
  config: initialConfig,
  items,
  sales: initialSales,
  canConfig,
  canSell,
  canHistory,
  canStats,
}: PartnerClientProps) {
  const [config, setConfig] = useState(initialConfig);
  const [currentItems, setCurrentItems] = useState(items);
  const [sales, setSales] = useState(initialSales);
  const [configDraft, setConfigDraft] = useState(initialConfig);
  const [kitsSold, setKitsSold] = useState(20);
  const [cuttersSold, setCuttersSold] = useState(20);
  const [amountReceived, setAmountReceived] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [reported, setReported] = useState<ReportedDraft[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [detailSale, setDetailSale] = useState<FourPartnerSale | null>(null);

  const today = useMemo(() => getFourPartnerCycleDay(config), [config]);
  const preview = useMemo(() => getFourPartnerPreview(config, 7), [config]);
  const nextPartner = useMemo(() => getNextPartnerDay(config), [config]);
  const nextOff = useMemo(() => getNextOffDay(config), [config]);

  const itemById = useMemo(() => {
    const map = new Map<number, Item>();
    currentItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [currentItems]);

  const kitItem = useMemo(
    () => currentItems.find((item) => normalizeName(item.name).includes('kit')),
    [currentItems],
  );

  const cutterItem = useMemo(
    () => currentItems.find((item) => normalizeName(item.name).includes('disqueuse')),
    [currentItems],
  );

  const kitStock = Number(kitItem?.quantity ?? 0);
  const cutterStock = Number(cutterItem?.quantity ?? 0);
  const kitAfter = Math.max(0, kitStock - kitsSold);
  const cutterAfter = Math.max(0, cutterStock - cuttersSold);
  const saleHasStock = kitStock >= kitsSold && cutterStock >= cuttersSold;
  const stockOk = kitStock >= 20 && cutterStock >= 20;

  const categories = useMemo(() => {
    const values = new Set(currentItems.map((item) => item.category_key).filter(Boolean) as string[]);
    return ['all', ...Array.from(values)];
  }, [currentItems]);

  const availableItems = useMemo(() => {
    const normalized = normalizeName(query);
    return currentItems
      .filter((item) => !kitItem || item.id !== kitItem.id)
      .filter((item) => !cutterItem || item.id !== cutterItem.id)
      .filter((item) => category === 'all' || item.category_key === category)
      .filter((item) => normalizeName(item.name).includes(normalized))
      .slice(0, 18);
  }, [category, currentItems, cutterItem, kitItem, query]);

  const selectedReported = useMemo(
    () =>
      reported
        .map((line) => ({
          ...line,
          item: itemById.get(line.item_id),
        }))
        .filter((line) => line.item),
    [itemById, reported],
  );

  const stats = useMemo(() => {
    const activeSales = sales.filter((sale) => sale.status !== 'canceled');
    const byPartner = activeSales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.partner_name] = (acc[sale.partner_name] ?? 0) + 1;
      return acc;
    }, {});

    const reportedTotals = activeSales.reduce<Record<string, number>>((acc, sale) => {
      sale.reported_items?.forEach((item) => {
        acc[item.item_name] = (acc[item.item_name] ?? 0) + item.quantity;
      });
      return acc;
    }, {});

    const cash = activeSales
      .filter((sale) => sale.payment_method === 'cash')
      .reduce((sum, sale) => sum + Number(sale.amount_received ?? 0), 0);
    const bank = activeSales
      .filter((sale) => sale.payment_method === 'bank')
      .reduce((sum, sale) => sum + Number(sale.amount_received ?? 0), 0);
    const kits = activeSales.reduce((sum, sale) => sum + Number(sale.kits_sold ?? 0), 0);
    const cutters = activeSales.reduce((sum, sale) => sum + Number(sale.cutters_sold ?? 0), 0);
    const objects = Object.values(reportedTotals).reduce((sum, quantity) => sum + quantity, 0);
    const avgStock = Math.round((kitStock + cutterStock) / 2);
    const cycleRespect = activeSales.length
      ? Math.round(
          (activeSales.filter((sale) => {
            const expected = getFourPartnerCycleDay(config, sale.sale_date);
            return !expected.isOff && expected.label === sale.partner_name;
          }).length /
            activeSales.length) *
            100,
        )
      : 100;

    return {
      byPartner,
      reportedTotals,
      cash,
      bank,
      kits,
      cutters,
      objects,
      avgStock,
      cycleRespect,
      offDays: preview.filter((day) => day.isOff).length,
    };
  }, [config, cutterStock, kitStock, preview, sales]);

  function addReportedItem(item: Item) {
    setReported((current) => {
      const existing = current.find((line) => line.item_id === item.id);
      if (existing) {
        return current.map((line) =>
          line.item_id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { item_id: item.id, quantity: 1 }];
    });
  }

  function changeReportedQuantity(itemId: number, quantity: number) {
    setReported((current) =>
      current
        .map((line) => (line.item_id === itemId ? { ...line, quantity: Math.max(0, quantity) } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function applyPayload(payload: {
    config?: FourPartnerConfig;
    items?: Item[];
    sales?: FourPartnerSale[];
    sale?: FourPartnerSale;
    itemUpdates?: Array<{ id: number; quantity: number }>;
  }) {
    if (payload.config) {
      setConfig(payload.config);
      setConfigDraft(payload.config);
    }
    if (payload.items) setCurrentItems(payload.items);
    if (payload.sales) setSales(payload.sales);
    if (payload.itemUpdates) {
      setCurrentItems((current) =>
        current.map((item) => {
          const update = payload.itemUpdates?.find((entry) => entry.id === item.id);
          return update ? { ...item, quantity: update.quantity } : item;
        }),
      );
    }
    if (payload.sale) {
      const nextSale = payload.sale;
      setSales((current) => {
        const exists = current.some((sale) => sale.id === nextSale.id);
        return exists
          ? current.map((sale) => (sale.id === nextSale.id ? nextSale : sale))
          : [nextSale, ...current];
      });
    }
  }

  async function saveConfig() {
    setError(null);
    const response = await fetch('/api/four/partner', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configDraft),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message ?? payload.error ?? 'Configuration impossible.');
      return;
    }
    applyPayload(payload);
  }

  async function submitSale() {
    setError(null);
    const response = await fetch('/api/four/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_name: today.label,
        sale_date: toDateKey(new Date()),
        kits_sold: kitsSold,
        cutters_sold: cuttersSold,
        amount_received: amountReceived,
        payment_method: paymentMethod,
        reported_items: reported
          .filter((line) => line.quantity > 0)
          .map((line) => ({
            ...line,
            item_name: itemById.get(line.item_id)?.name,
          })),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message ?? payload.error ?? 'Vente impossible.');
      return;
    }
    setReported([]);
    setAmountReceived(0);
    applyPayload(payload);
  }

  async function markBankReceived(sale: FourPartnerSale) {
    setError(null);
    const response = await fetch('/api/four/partner', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: sale.id }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message ?? payload.error ?? 'Mise a jour impossible.');
      return;
    }
    applyPayload(payload);
  }

  async function cancelSale(sale: FourPartnerSale) {
    const reason = window.prompt('Motif annulation vente partenaire ?');
    if (!reason) return;

    setError(null);
    const response = await fetch('/api/four/partner', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: sale.id, reason }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message ?? payload.error ?? 'Annulation impossible.');
      return;
    }
    applyPayload(payload);
  }

  return (
    <div className="space-y-4">
      <section className="grid items-stretch gap-4 xl:grid-cols-[1fr_1.05fr_.95fr]">
        <CycleCard
          canConfig={canConfig}
          configDraft={configDraft}
          setConfigDraft={setConfigDraft}
          saveConfig={saveConfig}
          todayStep={today.position}
        />

        <TodayCard
          today={today}
          kitStock={kitStock}
          cutterStock={cutterStock}
          stockOk={stockOk}
          nextPartner={nextPartner}
          nextOff={nextOff}
        />

        <PreviewCard preview={preview} />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      {!today.isOff && canSell ? (
        <section className="grid items-start gap-4 xl:grid-cols-[.9fr_1.1fr]">
          <SaleCard
            partner={today.label}
            kitsSold={kitsSold}
            cuttersSold={cuttersSold}
            amountReceived={amountReceived}
            paymentMethod={paymentMethod}
            kitStock={kitStock}
            cutterStock={cutterStock}
            kitAfter={kitAfter}
            cutterAfter={cutterAfter}
            saleHasStock={saleHasStock}
            setKitsSold={setKitsSold}
            setCuttersSold={setCuttersSold}
            setAmountReceived={setAmountReceived}
            setPaymentMethod={setPaymentMethod}
            submitSale={submitSale}
          />

          <ReportedItemsCard
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            categories={categories}
            availableItems={availableItems}
            selectedReported={selectedReported}
            addReportedItem={addReportedItem}
            changeReportedQuantity={changeReportedQuantity}
          />
        </section>
      ) : null}

      <section className="grid items-start gap-4 xl:grid-cols-[1.12fr_.88fr]">
        {canHistory ? (
          <HistoryCard
            sales={sales}
            onDetail={setDetailSale}
            onBankReceived={markBankReceived}
            onCancel={cancelSale}
          />
        ) : null}

        {canStats ? <StatsCard stats={stats} /> : null}
      </section>

      {detailSale ? <SaleDetail sale={detailSale} onClose={() => setDetailSale(null)} /> : null}
    </div>
  );
}

function CycleCard({
  canConfig,
  configDraft,
  setConfigDraft,
  saveConfig,
  todayStep,
}: {
  canConfig: boolean;
  configDraft: FourPartnerConfig;
  setConfigDraft: (config: FourPartnerConfig) => void;
  saveConfig: () => void;
  todayStep: number;
}) {
  const steps = [
    { label: 'J1', value: configDraft.partner_one },
    { label: 'J2', value: configDraft.partner_two },
    { label: 'J3', value: configDraft.partner_three },
    { label: 'J4', value: configDraft.off_label },
  ];

  return (
    <article className={CARD_CLASS}>
      <CardHeader eyebrow="Cycle 4 jours" title="Cycle partenaire" />

      <div className="mt-4 grid grid-cols-2 gap-2">
        {steps.map((step, index) => {
          const active = todayStep === index + 1;
          return (
            <div
              key={step.label}
              className={`rounded-2xl border p-3 transition ${
                active
                  ? 'border-[#8b5a2b] bg-[#6b3f1d] text-[#fff7e8] shadow-sm'
                  : 'border-white/10 bg-[#2f1d14]/65 text-[#ffe8ca]'
              }`}
            >
              <div className={`text-xs font-black uppercase ${active ? 'text-[#f6d7a7]' : 'text-[#f6d7a7]'}`}>
                {step.label}
              </div>
              <div className="mt-1 truncate text-sm font-black">{step.value}</div>
            </div>
          );
        })}
      </div>

      {canConfig ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <LabeledInput
              label="Partenaire 1"
              value={configDraft.partner_one}
              onChange={(value) => setConfigDraft({ ...configDraft, partner_one: value })}
            />
            <LabeledInput
              label="Partenaire 2"
              value={configDraft.partner_two}
              onChange={(value) => setConfigDraft({ ...configDraft, partner_two: value })}
            />
            <LabeledInput
              label="Partenaire 3"
              value={configDraft.partner_three}
              onChange={(value) => setConfigDraft({ ...configDraft, partner_three: value })}
            />
            <LabeledInput
              label="Jour off"
              value={configDraft.off_label}
              onChange={(value) => setConfigDraft({ ...configDraft, off_label: value })}
            />
          </div>

          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">Date de depart</span>
              <input
                type="date"
                value={configDraft.cycle_start_date}
                onChange={(event) =>
                  setConfigDraft({ ...configDraft, cycle_start_date: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="button"
              onClick={saveConfig}
              className="rounded-xl bg-[#6b3f1d] px-4 py-2 text-sm font-black text-[#fff7e8] shadow-sm transition hover:bg-[#4b2a15]"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3 text-sm font-semibold text-[#efcdab]">
          Depart du cycle : {configDraft.cycle_start_date}
        </div>
      )}
    </article>
  );
}

function TodayCard({
  today,
  kitStock,
  cutterStock,
  stockOk,
  nextPartner,
  nextOff,
}: {
  today: ReturnType<typeof getFourPartnerCycleDay>;
  kitStock: number;
  cutterStock: number;
  stockOk: boolean;
  nextPartner: ReturnType<typeof getNextPartnerDay>;
  nextOff: ReturnType<typeof getNextOffDay>;
}) {
  return (
    <article className={`${CARD_CLASS} relative overflow-hidden`}>
      <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-[#2f1d14]/65 px-3 py-1 text-xs font-black uppercase text-[#efcdab]">
        Aujourd&apos;hui
      </div>

      <CardHeader eyebrow={today.isOff ? 'Repos cycle' : 'Partenaire actif'} title={today.label} />

      {today.isOff ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#f2cc9b]/35 bg-[#2f1d14]/65 p-4">
          <div className="text-sm font-black uppercase text-[#efcdab]">Objectif</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#5f3b22]">
            Refaire les stocks. Aucune vente partenaire n&apos;est prevue aujourd&apos;hui.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StockTile label="Kits a vendre" value="20" footer={`Stock actuel : ${kitStock}`} />
            <StockTile label="Disqueuses a vendre" value="20" footer={`Stock actuel : ${cutterStock}`} />
          </div>

          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-black ${
              stockOk
                ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-300/40 bg-amber-500/10 text-amber-100'
            }`}
          >
            {stockOk ? 'Stock OK' : 'Stock insuffisant'}
          </div>
        </>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <InfoLine label="Prochain partenaire" value={nextPartner ? `${nextPartner.label} - ${nextPartner.date}` : '-'} />
        <InfoLine label="Prochain day-off" value={nextOff ? nextOff.date : '-'} />
      </div>
    </article>
  );
}

function PreviewCard({ preview }: { preview: ReturnType<typeof getFourPartnerPreview> }) {
  const todayKey = toDateKey();

  return (
    <article className={CARD_CLASS}>
      <CardHeader eyebrow="Planning" title="7 prochains jours" />
      <div className="mt-4 space-y-2">
        {preview.map((day) => (
          <div
            key={day.date}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${
              day.date === todayKey
                ? 'border-[#8b5a2b] bg-[#6b3f1d] text-[#fff7e8]'
                : 'border-white/10 bg-[#2f1d14]/65 text-[#ffe8ca]'
            }`}
          >
            <div>
              <div className={`text-xs font-black uppercase ${day.date === todayKey ? 'text-[#f6d7a7]' : 'text-[#f6d7a7]'}`}>
                {compactDate(day.date)}
              </div>
              <div className="text-sm font-black">{day.label}</div>
            </div>
            <div className="rounded-full border border-current/25 px-2 py-1 text-xs font-black">
              {day.isOff ? 'Off' : `J${day.position}`}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function SaleCard({
  partner,
  kitsSold,
  cuttersSold,
  amountReceived,
  paymentMethod,
  kitStock,
  cutterStock,
  kitAfter,
  cutterAfter,
  saleHasStock,
  setKitsSold,
  setCuttersSold,
  setAmountReceived,
  setPaymentMethod,
  submitSale,
}: {
  partner: string;
  kitsSold: number;
  cuttersSold: number;
  amountReceived: number;
  paymentMethod: 'cash' | 'bank';
  kitStock: number;
  cutterStock: number;
  kitAfter: number;
  cutterAfter: number;
  saleHasStock: boolean;
  setKitsSold: (value: number) => void;
  setCuttersSold: (value: number) => void;
  setAmountReceived: (value: number) => void;
  setPaymentMethod: (value: 'cash' | 'bank') => void;
  submitSale: () => void;
}) {
  return (
    <article className={CARD_CLASS}>
      <CardHeader eyebrow="Validation" title="Vente partenaire" />

      <div className="mt-4 space-y-3">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">Partenaire</span>
          <input value={partner} readOnly className={`${INPUT_CLASS} font-black`} />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">Montant recu</span>
          <input
            type="number"
            min={0}
            value={amountReceived}
            onChange={(event) => setAmountReceived(Number(event.target.value))}
            className={INPUT_CLASS}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Stepper label="Kits vendus" value={kitsSold} onChange={setKitsSold} />
          <Stepper label="Disqueuses vendues" value={cuttersSold} onChange={setCuttersSold} />
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-1">
          {(['cash', 'bank'] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                paymentMethod === method
                  ? 'bg-[#6b3f1d] text-[#fff7e8]'
                  : 'text-[#efcdab] hover:bg-[#4a2f20]/80'
              }`}
            >
              {method === 'cash' ? 'Cash' : 'Bank'}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
          <div className="text-xs font-black uppercase text-[#efcdab]">Recap vente</div>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-[#ffe8ca] sm:grid-cols-2">
            <InfoLine label="Kits" value={`${kitStock} -> ${kitAfter}`} />
            <InfoLine label="Disqueuses" value={`${cutterStock} -> ${cutterAfter}`} />
            <InfoLine
              label={paymentMethod === 'cash' ? 'Argent ajoute' : 'Bank en attente'}
              value={formatUsd(amountReceived)}
            />
            <InfoLine label="Stock" value={saleHasStock ? 'OK' : 'Insuffisant'} />
          </div>
        </div>

        <button
          type="button"
          onClick={submitSale}
          disabled={!saleHasStock}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-black text-[#fff7e8] shadow-sm transition ${
            saleHasStock ? 'bg-[#6b3f1d] hover:bg-[#4b2a15]' : 'cursor-not-allowed bg-[#9f8669] opacity-60'
          }`}
        >
          Valider vente partenaire
        </button>
      </div>
    </article>
  );
}

function ReportedItemsCard({
  query,
  setQuery,
  category,
  setCategory,
  categories,
  availableItems,
  selectedReported,
  addReportedItem,
  changeReportedQuantity,
}: {
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
  availableItems: Item[];
  selectedReported: Array<ReportedDraft & { item?: Item }>;
  addReportedItem: (item: Item) => void;
  changeReportedQuantity: (itemId: number, quantity: number) => void;
}) {
  return (
    <article className={CARD_CLASS}>
      <CardHeader eyebrow="Retours stock" title="Objets rapportes" />

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un item"
          className={INPUT_CLASS}
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT_CLASS}>
          {categories.map((value) => (
            <option key={value} value={value}>
              {categoryLabel(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_.92fr]">
        <div className="min-h-[280px] rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-black uppercase text-[#efcdab]">Liste items</div>
            <div className="text-xs font-bold text-[#efcdab]">{availableItems.length} resultats</div>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {availableItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-[#2b1a12]/70 p-2"
              >
                <ItemImage item={item} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-[#fff1dd]">{item.name}</div>
                  <div className="text-xs font-semibold text-[#efcdab]">Stock actuel : {item.quantity}</div>
                </div>
                <button
                  type="button"
                  onClick={() => addReportedItem(item)}
                  className="rounded-xl border border-white/15 bg-[#5b3924]/75 px-3 py-2 text-sm font-black text-[#ffe8ca] transition hover:bg-[#6b452d]/85"
                >
                  Ajouter
                </button>
              </div>
            ))}
            {availableItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#f2cc9b]/35 p-4 text-center text-sm font-semibold text-[#efcdab]">
                Aucun item trouve.
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-[280px] rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
          <div className="mb-3 text-xs font-black uppercase text-[#efcdab]">Objets selectionnes</div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {selectedReported.map((line) => (
              <div
                key={line.item_id}
                className="rounded-2xl border border-white/10 bg-[#2b1a12]/70 p-2"
              >
                <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3">
                  <ItemImage item={line.item} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-[#fff1dd]">{line.item?.name}</div>
                    <div className="text-xs font-semibold text-[#efcdab]">Stock : {line.item?.quantity ?? 0}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeReportedQuantity(line.item_id, 0)}
                    className="h-8 w-8 rounded-full border border-white/10 bg-[#2f1d14]/65 text-sm font-black text-[#efcdab] transition hover:bg-red-500/15 hover:text-red-100"
                    aria-label="Retirer"
                  >
                    x
                  </button>
                </div>
                <div className="mt-2">
                  <Stepper
                    label="Quantite"
                    value={line.quantity}
                    min={1}
                    onChange={(value) => changeReportedQuantity(line.item_id, value)}
                  />
                </div>
              </div>
            ))}
            {selectedReported.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#f2cc9b]/35 p-4 text-center text-sm font-semibold text-[#efcdab]">
                Aucun objet selectionne.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function HistoryCard({
  sales,
  onDetail,
  onBankReceived,
  onCancel,
}: {
  sales: FourPartnerSale[];
  onDetail: (sale: FourPartnerSale) => void;
  onBankReceived: (sale: FourPartnerSale) => void;
  onCancel: (sale: FourPartnerSale) => void;
}) {
  return (
    <article className={CARD_CLASS}>
      <CardHeader eyebrow="Suivi" title="Historique partenaire" />

      <div className="mt-4 space-y-3">
        {sales.slice(0, 10).map((sale) => (
          <div key={sale.id} className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-[#fff1dd]">{sale.partner_name}</div>
                <div className="text-xs font-semibold text-[#efcdab]">{formatDate(sale.created_at)}</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(sale.status)}`}>
                {statusLabel(sale.status)}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-sm font-semibold text-[#ffe8ca] sm:grid-cols-4">
              <InfoLine label="Kits" value={String(sale.kits_sold)} />
              <InfoLine label="Disqueuses" value={String(sale.cutters_sold)} />
              <InfoLine label="Mode" value={sale.payment_method === 'cash' ? 'Cash' : 'Bank'} />
              <InfoLine label="Montant" value={formatUsd(sale.amount_received)} />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-[#2b1a12]/70 px-3 py-2 text-xs font-semibold text-[#efcdab]">
              Objets rapportes :{' '}
              {sale.reported_items?.length
                ? sale.reported_items.map((item) => `${item.item_name} x${item.quantity}`).join(' Â· ')
                : 'Aucun'}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <SmallButton onClick={() => onDetail(sale)}>Voir detail</SmallButton>
              {sale.status === 'bank_pending' ? (
                <SmallButton onClick={() => onBankReceived(sale)}>Marquer bank recu</SmallButton>
              ) : null}
              {sale.status !== 'canceled' ? (
                <SmallButton danger onClick={() => onCancel(sale)}>
                  Annuler
                </SmallButton>
              ) : null}
            </div>
          </div>
        ))}

        {sales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#f2cc9b]/35 p-4 text-center text-sm font-semibold text-[#efcdab]">
            Aucune vente partenaire.
          </div>
        ) : null}
      </div>
    </article>
  );
}

function StatsCard({
  stats,
}: {
  stats: {
    byPartner: Record<string, number>;
    reportedTotals: Record<string, number>;
    cash: number;
    bank: number;
    kits: number;
    cutters: number;
    objects: number;
    avgStock: number;
    cycleRespect: number;
    offDays: number;
  };
}) {
  return (
    <article className={CARD_CLASS}>
      <CardHeader eyebrow="Performance" title="Stats partenaire" />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat label="Cash total" value={formatUsd(stats.cash)} />
        <MiniStat label="Bank total" value={formatUsd(stats.bank)} />
        <MiniStat label="Kits vendus" value={String(stats.kits)} />
        <MiniStat label="Disqueuses" value={String(stats.cutters)} />
        <MiniStat label="Objets rapportes" value={String(stats.objects)} />
        <MiniStat label="Cycle respecte" value={`${stats.cycleRespect}%`} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <StatList title="Ventes par partenaire" values={stats.byPartner} empty="Aucune vente" />
        <StatList title="Retours objets" values={stats.reportedTotals} empty="Aucun retour" />
      </div>

      <div className="mt-4 grid gap-2 text-sm font-semibold text-[#ffe8ca] sm:grid-cols-2">
        <InfoLine label="Jours off visibles" value={String(stats.offDays)} />
        <InfoLine label="Stock moyen restant" value={String(stats.avgStock)} />
      </div>
    </article>
  );
}

function CardHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-[#f6d7a7]">{eyebrow}</div>
      <h2 className="mt-1 text-xl font-black text-[#fff1dd]">{title}</h2>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS} />
    </label>
  );
}

function StockTile({ label, value, footer }: { label: string; value: string; footer: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-4">
      <div className="text-xs font-black uppercase text-[#efcdab]">{label}</div>
      <div className="mt-2 text-3xl font-black text-[#fff1dd]">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[#efcdab]">{footer}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#2b1a12]/70 px-3 py-2">
      <div className="text-[11px] font-black uppercase text-[#f6d7a7]">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-[#fff1dd]">{value}</div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-[#efcdab]">{label}</div>
      <div className="mt-2 grid grid-cols-[36px_1fr_36px] items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 rounded-xl border border-white/15 bg-[#5b3924]/75 text-lg font-black text-[#ffe8ca] transition hover:bg-[#6b452d]/85"
        >
          -
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value)))}
          className={`${INPUT_CLASS} px-2 text-center font-black`}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-9 rounded-xl border border-white/15 bg-[#5b3924]/75 text-lg font-black text-[#ffe8ca] transition hover:bg-[#6b452d]/85"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ItemImage({ item }: { item?: Pick<Item, 'name' | 'image_url'> }) {
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-[#3f281b]/70">
      {item?.image_url ? (
        <Image src={item.image_url} alt={item.name} fill sizes="40px" className="object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-xs font-black text-[#efcdab]">
          {(item?.name ?? '?').slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
        danger
          ? 'border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/15'
          : 'border-white/15 bg-[#5b3924]/75 text-[#ffe8ca] hover:bg-[#6b452d]/85'
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
      <div className="text-[11px] font-black uppercase text-[#f6d7a7]">{label}</div>
      <div className="mt-1 text-lg font-black text-[#fff1dd]">{value}</div>
    </div>
  );
}

function StatList({
  title,
  values,
  empty,
}: {
  title: string;
  values: Record<string, number>;
  empty: string;
}) {
  const entries = Object.entries(values).slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
      <div className="text-xs font-black uppercase text-[#efcdab]">{title}</div>
      <div className="mt-2 space-y-2">
        {entries.map(([name, value]) => (
          <div key={name} className="flex items-center justify-between gap-3 text-sm font-semibold text-[#ffe8ca]">
            <span className="truncate">{name}</span>
            <span className="font-black">{value}</span>
          </div>
        ))}
        {entries.length === 0 ? <div className="text-sm font-semibold text-[#efcdab]">{empty}</div> : null}
      </div>
    </div>
  );
}

function SaleDetail({ sale, onClose }: { sale: FourPartnerSale; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#4a2f20] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#f6d7a7]">Detail vente</div>
            <h3 className="mt-1 text-xl font-black text-[#fff1dd]">{sale.partner_name}</h3>
            <p className="mt-1 text-sm font-semibold text-[#efcdab]">{formatDate(sale.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-white/10 bg-[#2f1d14]/65 text-sm font-black text-[#efcdab]"
          >
            x
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <InfoLine label="Kits vendus" value={String(sale.kits_sold)} />
          <InfoLine label="Disqueuses vendues" value={String(sale.cutters_sold)} />
          <InfoLine label="Paiement" value={sale.payment_method === 'cash' ? 'Cash' : 'Bank'} />
          <InfoLine label="Montant" value={formatUsd(sale.amount_received)} />
          <InfoLine label="Statut" value={statusLabel(sale.status)} />
          <InfoLine label="Date cycle" value={sale.sale_date} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
          <div className="text-xs font-black uppercase text-[#efcdab]">Objets rapportes</div>
          <div className="mt-2 space-y-2">
            {sale.reported_items?.map((item) => (
              <div key={`${item.item_id}-${item.item_name}`} className="flex items-center gap-3 text-sm font-semibold text-[#ffe8ca]">
                <ItemImage item={{ name: item.item_name, image_url: item.image_url }} />
                <span className="min-w-0 flex-1 truncate">{item.item_name}</span>
                <span className="font-black">x{item.quantity}</span>
              </div>
            ))}
            {!sale.reported_items?.length ? (
              <div className="text-sm font-semibold text-[#efcdab]">Aucun objet rapporte.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
