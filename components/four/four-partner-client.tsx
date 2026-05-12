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
  buy_price?: number | null;
  category_key?: string | null;
  type_key?: string | null;
  image_url?: string | null;
  image?: string | null;
  icon_url?: string | null;
};

export type FourPartnerSale = {
  id: number;
  sale_date: string;
  partner_name: string;
  kits_sold: number;
  cutters_sold: number;
  kit_unit_price?: number | null;
  cutter_unit_price?: number | null;
  amount_received: number;
  payment_method: 'cash' | 'bank';
  status: 'validated' | 'bank_pending' | 'bank_received' | 'canceled';
  reported_items?: Array<{
    item_id: number;
    item_name: string;
    quantity: number;
    image_url?: string | null;
    image?: string | null;
    icon_url?: string | null;
    before?: number;
    after?: number;
    purchase_unit_price?: number;
    total_purchase?: number;
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
  purchase_unit_price: number;
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
  'glass-card h-full rounded-2xl border border-[#f2cc9b]/18 bg-[#533621]/72 p-4 shadow-sm shadow-black/10 md:p-5';

const INPUT_CLASS =
  'w-full rounded-xl border border-[#f2cc9b]/16 bg-[#2d1b12]/78 px-3 py-2 text-sm text-[#fff1dd] outline-none transition focus:border-[#f2cc9b]/70 focus:ring-2 focus:ring-[#f2cc9b]/15';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Toutes catégories',
  objects: 'Objets',
  objets: 'Objets',
  equipment: 'Équipement',
  Equipment: 'Équipement',
  weapons: 'Armes',
  other: 'Autres',
  misc: 'Autres',
  drugs: 'Produits',
  produits: 'Produits',
  Produits: 'Produits',
  Objets: 'Objets',
};

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function statusLabel(status: FourPartnerSale['status']) {
  if (status === 'bank_pending') return 'Bank en attente';
  if (status === 'bank_received') return 'Reçu bank';
  if (status === 'canceled') return 'Annulé';
  return 'Validé';
}

function statusTone(status: FourPartnerSale['status']) {
  if (status === 'bank_pending') return 'border-amber-300/40 bg-amber-500/10 text-amber-100';
  if (status === 'bank_received') return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100';
  if (status === 'canceled') return 'border-red-300/40 bg-red-100 text-red-900';
  return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100';
}

function categoryLabel(value: string) {
  return CATEGORY_LABELS[value] ?? CATEGORY_LABELS[value.toLowerCase()] ?? 'Autres';
}

function categoryKey(value?: string | null) {
  const normalized = String(value || 'objects').trim().toLowerCase();
  if (['objects', 'objets', 'object'].includes(normalized)) return 'objects';
  if (['equipment', 'equipement', 'équipement'].includes(normalized)) return 'equipment';
  if (['weapons', 'armes', 'weapon'].includes(normalized)) return 'weapons';
  if (['drugs', 'produits', 'product', 'products'].includes(normalized)) return 'drugs';
  if (['other', 'others', 'misc', 'autres'].includes(normalized)) return 'other';
  return 'other';
}

function itemImageUrl(item?: Pick<Item, 'image_url' | 'image' | 'icon_url'> | null) {
  return item?.image_url || item?.image || item?.icon_url || null;
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

function moneyValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function reportedLineTotal(line: Pick<ReportedDraft, 'quantity' | 'purchase_unit_price'>) {
  return Math.max(0, Number(line.quantity ?? 0)) * moneyValue(line.purchase_unit_price);
}

function saleReportedPurchaseTotal(sale: FourPartnerSale) {
  return (sale.reported_items ?? []).reduce((sum, item) => {
    const explicitTotal = typeof item.total_purchase === 'number' ? Number(item.total_purchase) : null;
    return sum + (explicitTotal ?? Number(item.quantity ?? 0) * moneyValue(item.purchase_unit_price));
  }, 0);
}

function saleNetResult(sale: FourPartnerSale) {
  return Number(sale.amount_received ?? 0) - saleReportedPurchaseTotal(sale);
}

function saleCashImpact(sale: FourPartnerSale) {
  if (sale.status === 'canceled') return 0;
  if (sale.payment_method === 'bank' && sale.status === 'bank_pending') return -saleReportedPurchaseTotal(sale);
  return saleNetResult(sale);
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
  const [kitPrice, setKitPrice] = useState(0);
  const [cutterPrice, setCutterPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [reported, setReported] = useState<ReportedDraft[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('objects');
  const [error, setError] = useState<string | null>(null);
  const [detailSale, setDetailSale] = useState<FourPartnerSale | null>(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

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
  const saleTotal = Math.max(0, kitsSold * kitPrice + cuttersSold * cutterPrice);
  const reportedPurchaseTotal = useMemo(
    () => reported.reduce((sum, line) => sum + reportedLineTotal(line), 0),
    [reported],
  );
  const netResult = saleTotal - reportedPurchaseTotal;
  const cashImpact = paymentMethod === 'cash' ? netResult : -reportedPurchaseTotal;

  const categories = useMemo(() => {
    const values = new Set(currentItems.map((item) => categoryKey(item.category_key)));
    return Array.from(new Set(['objects', 'all', ...Array.from(values)]));
  }, [currentItems]);

  const availableItems = useMemo(() => {
    const normalized = normalizeName(query);
    return currentItems
      .filter((item) => !kitItem || item.id !== kitItem.id)
      .filter((item) => !cutterItem || item.id !== cutterItem.id)
      .filter((item) => category === 'all' || categoryKey(item.category_key) === category)
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
      return [...current, { item_id: item.id, quantity: 1, purchase_unit_price: moneyValue(item.buy_price) }];
    });
  }

  function changeReportedQuantity(itemId: number, quantity: number) {
    setReported((current) =>
      current
        .map((line) => (line.item_id === itemId ? { ...line, quantity: Math.max(0, quantity) } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function changeReportedPrice(itemId: number, purchaseUnitPrice: number) {
    setReported((current) =>
      current.map((line) =>
        line.item_id === itemId ? { ...line, purchase_unit_price: moneyValue(purchaseUnitPrice) } : line,
      ),
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
    if (isSubmittingSale) return;
    setError(null);
    if (!saleHasStock) {
      setError(`Stock insuffisant: kits ${kitStock}/${kitsSold}, disqueuses ${cutterStock}/${cuttersSold}.`);
      return;
    }
    setIsSubmittingSale(true);
    try {
      const response = await fetch('/api/four/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_name: today.label,
          sale_date: toDateKey(new Date()),
          kits_sold: kitsSold,
          cutters_sold: cuttersSold,
          kit_unit_price: kitPrice,
          cutter_unit_price: cutterPrice,
          amount_received: saleTotal,
          payment_method: paymentMethod,
          reported_items: reported
            .filter((line) => line.quantity > 0)
            .map((line) => ({
              ...line,
              item_name: itemById.get(line.item_id)?.name,
              total_purchase: reportedLineTotal(line),
            })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? 'Vente impossible.');
        return;
      }
      setReported([]);
      applyPayload(payload);
    } catch {
      setError('Vente impossible.');
    } finally {
      setIsSubmittingSale(false);
    }
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
          kitItem={kitItem}
          cutterItem={cutterItem}
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
            kitPrice={kitPrice}
            cutterPrice={cutterPrice}
            saleTotal={saleTotal}
            reportedPurchaseTotal={reportedPurchaseTotal}
            netResult={netResult}
            cashImpact={cashImpact}
            paymentMethod={paymentMethod}
            kitStock={kitStock}
            cutterStock={cutterStock}
            kitAfter={kitAfter}
            cutterAfter={cutterAfter}
            saleHasStock={saleHasStock}
            isSubmitting={isSubmittingSale}
            kitItem={kitItem}
            cutterItem={cutterItem}
            setKitsSold={setKitsSold}
            setCuttersSold={setCuttersSold}
            setKitPrice={setKitPrice}
            setCutterPrice={setCutterPrice}
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
            changeReportedPrice={changeReportedPrice}
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
      <CardHeader icon="🔁" eyebrow="Cycle 4 jours" title="Cycle partenaire" />

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
              <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">Date de départ</span>
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
          Départ du cycle : {configDraft.cycle_start_date}
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
  kitItem,
  cutterItem,
}: {
  today: ReturnType<typeof getFourPartnerCycleDay>;
  kitStock: number;
  cutterStock: number;
  stockOk: boolean;
  nextPartner: ReturnType<typeof getNextPartnerDay>;
  nextOff: ReturnType<typeof getNextOffDay>;
  kitItem?: Item;
  cutterItem?: Item;
}) {
  return (
    <article className={`${CARD_CLASS} relative overflow-hidden`}>
      <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-[#2f1d14]/65 px-3 py-1 text-xs font-black uppercase text-[#efcdab]">
        Aujourd&apos;hui
      </div>

      <CardHeader icon={today.isOff ? '🌙' : '🤝'} eyebrow={today.isOff ? 'Repos cycle' : 'Partenaire actif'} title={today.label} />

      {today.isOff ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#f2cc9b]/35 bg-[#2f1d14]/65 p-4">
          <div className="text-sm font-black uppercase text-[#efcdab]">Objectif</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#ffe8ca]">
            Refaire les stocks. Aucune vente partenaire n&apos;est prévue aujourd&apos;hui.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StockTile item={kitItem} fallback="🧰" label="Kits à vendre" value="20" footer={`Stock actuel : ${kitStock}`} />
            <StockTile item={cutterItem} fallback="🛠️" label="Disqueuses à vendre" value="20" footer={`Stock actuel : ${cutterStock}`} />
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
      <CardHeader icon="🗓️" eyebrow="Planning" title="7 prochains jours" />
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
  kitPrice,
  cutterPrice,
  saleTotal,
  reportedPurchaseTotal,
  netResult,
  cashImpact,
  paymentMethod,
  kitStock,
  cutterStock,
  kitAfter,
  cutterAfter,
  saleHasStock,
  isSubmitting,
  kitItem,
  cutterItem,
  setKitsSold,
  setCuttersSold,
  setKitPrice,
  setCutterPrice,
  setPaymentMethod,
  submitSale,
}: {
  partner: string;
  kitsSold: number;
  cuttersSold: number;
  kitPrice: number;
  cutterPrice: number;
  saleTotal: number;
  reportedPurchaseTotal: number;
  netResult: number;
  cashImpact: number;
  paymentMethod: 'cash' | 'bank';
  kitStock: number;
  cutterStock: number;
  kitAfter: number;
  cutterAfter: number;
  saleHasStock: boolean;
  isSubmitting: boolean;
  kitItem?: Item;
  cutterItem?: Item;
  setKitsSold: (value: number) => void;
  setCuttersSold: (value: number) => void;
  setKitPrice: (value: number) => void;
  setCutterPrice: (value: number) => void;
  setPaymentMethod: (value: 'cash' | 'bank') => void;
  submitSale: () => void;
}) {
  const clampKitsSold = (value: number) => setKitsSold(Math.max(0, Math.min(kitStock, value)));
  const clampCuttersSold = (value: number) => setCuttersSold(Math.max(0, Math.min(cutterStock, value)));

  return (
    <article className={CARD_CLASS}>
      <CardHeader icon="🧾" eyebrow="Validation" title="Vente partenaire" />

      <div className="mt-4 space-y-3">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">Partenaire</span>
          <input value={partner} readOnly className={`${INPUT_CLASS} font-black`} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Stepper iconItem={kitItem} iconFallback="🧰" label="Kits vendus" value={kitsSold} onChange={clampKitsSold} />
          <Stepper iconItem={cutterItem} iconFallback="🛠️" label="Disqueuses vendues" value={cuttersSold} onChange={clampCuttersSold} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput label="Prix kit" value={kitPrice} onChange={setKitPrice} />
          <MoneyInput label="Prix disqueuse" value={cutterPrice} onChange={setCutterPrice} />
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
            <ItemInfoLine item={kitItem} fallback="🧰" label="Kits vendus" value={`${kitsSold} x ${formatUsd(kitPrice)}`} />
            <ItemInfoLine item={cutterItem} fallback="🛠️" label="Disqueuses vendues" value={`${cuttersSold} x ${formatUsd(cutterPrice)}`} />
            <ItemInfoLine item={kitItem} fallback="🧰" label="Kits avant/après" value={`${kitStock} -> ${kitAfter}`} />
            <ItemInfoLine item={cutterItem} fallback="🛠️" label="Disqueuses avant/après" value={`${cutterStock} -> ${cutterAfter}`} />
            <InfoLine label="Total vente kits/disqueuses" value={formatUsd(saleTotal)} />
            <InfoLine label="Total achat objets rapportés" value={formatUsd(reportedPurchaseTotal)} />
            <InfoLine label="Résultat net" value={formatUsd(netResult)} />
            <InfoLine
              label={paymentMethod === 'cash' ? 'Impact cash' : 'Impact bank'}
              value={formatUsd(cashImpact)}
            />
            <InfoLine label="Stock" value={saleHasStock ? 'OK' : 'Insuffisant'} />
          </div>
        </div>

        <button
          type="button"
          onClick={submitSale}
          disabled={!saleHasStock || isSubmitting}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-black text-[#fff7e8] shadow-sm transition ${
            saleHasStock && !isSubmitting ? 'bg-[#6b3f1d] hover:bg-[#4b2a15]' : 'cursor-not-allowed bg-[#9f8669] opacity-60'
          }`}
        >
          {isSubmitting ? 'Validation...' : 'Valider vente partenaire'}
        </button>
        {!saleHasStock ? (
          <div className="rounded-2xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
            Stock insuffisant: kits {kitStock}/{kitsSold}, disqueuses {cutterStock}/{cuttersSold}.
          </div>
        ) : null}
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
  changeReportedPrice,
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
  changeReportedPrice: (itemId: number, purchaseUnitPrice: number) => void;
}) {
  const selectedCount = selectedReported.length;
  const selectedQuantityTotal = selectedReported.reduce((sum, line) => sum + line.quantity, 0);
  const selectedPurchaseTotal = selectedReported.reduce((sum, line) => sum + reportedLineTotal(line), 0);

  return (
    <article className={CARD_CLASS}>
      <CardHeader icon="🎒" eyebrow="Retours stock" title="Objets rapportés" />

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

      <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
        <div className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-black uppercase text-[#efcdab]">Liste items</div>
            <div className="text-xs font-bold text-[#efcdab]">{availableItems.length} résultats</div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {availableItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-[#2b1a12]/70 p-2"
              >
                <ItemImage item={item} fallback="📦" />
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
                Aucun item trouvé.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-2">
          <div className="mb-3 text-xs font-black uppercase text-[#efcdab]">Objets sélectionnés</div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {selectedReported.map((line) => {
              const lineTotal = reportedLineTotal(line);
              return (
                <div
                  key={line.item_id}
                  className="w-full rounded-xl border border-white/10 bg-[#2b1a12]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-start gap-3">
                    <ItemImage item={line.item} fallback="Item" compact />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-[#fff1dd]">{line.item?.name}</div>
                      <div className="text-[11px] font-semibold text-[#efcdab]">
                        Stock actuel : {line.item?.quantity ?? 0}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeReportedQuantity(line.item_id, 0)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#2f1d14]/65 text-sm font-black text-[#efcdab] transition hover:bg-red-500/15 hover:text-red-100"
                      aria-label="Retirer"
                    >
                      x
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 min-[760px]:grid-cols-[8.75rem_minmax(10.5rem,1fr)_9.75rem] min-[760px]:items-end">
                    <CompactQuantityControl
                      value={line.quantity}
                      onDecrease={() => changeReportedQuantity(line.item_id, Math.max(1, line.quantity - 1))}
                      onIncrease={() => changeReportedQuantity(line.item_id, line.quantity + 1)}
                    />
                    <label className="min-w-0 space-y-1">
                      <span className="block h-4 whitespace-nowrap text-[10px] font-black uppercase leading-4 text-[#efcdab]">
                        Prix achat
                      </span>
                      <input
                        value={line.purchase_unit_price}
                        inputMode="decimal"
                        onChange={(event) => changeReportedPrice(line.item_id, moneyValue(event.target.value))}
                        className={`${INPUT_CLASS} !h-9 w-full px-3 py-0 text-sm font-bold tabular-nums`}
                      />
                    </label>
                    <div className="min-w-0 space-y-1">
                      <span className="block h-4 whitespace-nowrap text-[10px] font-black uppercase leading-4 text-[#efcdab]">
                        Total ligne
                      </span>
                      <div className="flex h-9 w-full items-center justify-end rounded-lg border border-white/10 bg-[#2f1d14]/65 px-3 text-sm font-black tabular-nums text-[#fff1dd]">
                        {formatUsd(lineTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedReported.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#f2cc9b]/35 p-4 text-center text-sm font-semibold text-[#efcdab]">
                Aucun objet sélectionné.
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-[#2b1a12]/85 p-2 sm:grid-cols-3">
            <SummaryPill label="Objets sélectionnés" value={selectedCount.toLocaleString('fr-FR')} />
            <SummaryPill label="Quantité totale" value={selectedQuantityTotal.toLocaleString('fr-FR')} />
            <SummaryPill label="Total achat" value={formatUsd(selectedPurchaseTotal)} highlight />
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
      <CardHeader icon="📚" eyebrow="Suivi" title="Historique partenaire" />

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
              <InfoLine label="Total vente" value={formatUsd(sale.amount_received)} />
              <InfoLine label="Achat objets" value={formatUsd(saleReportedPurchaseTotal(sale))} />
              <InfoLine label="Résultat net" value={formatUsd(saleNetResult(sale))} />
              <InfoLine label="Impact caisse" value={formatUsd(saleCashImpact(sale))} />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-[#2b1a12]/70 px-3 py-2 text-xs font-semibold text-[#efcdab]">
              <div className="mb-2 text-[11px] font-black uppercase text-[#f6d7a7]">Objets rapportés</div>
              {sale.reported_items?.length ? (
                <div className="flex flex-wrap gap-2">
                  {sale.reported_items.map((item) => (
                    <span
                      key={`${sale.id}-${item.item_id}-${item.item_name}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#2f1d14]/65 px-2 py-1 text-[#ffe8ca]"
                    >
                      <ItemImage item={{ name: item.item_name, image_url: item.image_url, image: item.image, icon_url: item.icon_url }} fallback="📦" />
                      <span>{item.item_name} x{item.quantity} · {formatUsd(moneyValue(item.purchase_unit_price))}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span>Aucun</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <SmallButton onClick={() => onDetail(sale)}>Voir détail</SmallButton>
              {sale.status === 'bank_pending' ? (
                <SmallButton onClick={() => onBankReceived(sale)}>Marquer bank reçu</SmallButton>
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
      <CardHeader icon="📊" eyebrow="Performance" title="Stats partenaire" />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat label="Cash total" value={formatUsd(stats.cash)} />
        <MiniStat label="Bank total" value={formatUsd(stats.bank)} />
        <MiniStat label="Kits vendus" value={String(stats.kits)} />
        <MiniStat label="Disqueuses" value={String(stats.cutters)} />
        <MiniStat label="Objets rapportés" value={String(stats.objects)} />
        <MiniStat label="Cycle respecté" value={`${stats.cycleRespect}%`} />
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

function CardHeader({ eyebrow, title, icon }: { eyebrow: string; title: string; icon?: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#f2cc9b]/18 bg-[#2d1b12]/70 text-lg">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#f6d7a7]">{eyebrow}</div>
        <h2 className="mt-1 truncate text-xl font-black text-[#fff1dd]">{title}</h2>
      </div>
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

function StockTile({
  label,
  value,
  footer,
  item,
  fallback = '📦',
}: {
  label: string;
  value: string;
  footer: string;
  item?: Item;
  fallback?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-4">
      <div className="flex items-start gap-3">
        <ItemImage item={item} fallback={fallback} />
        <div className="min-w-0">
          <div className="text-xs font-black uppercase text-[#efcdab]">{label}</div>
          <div className="mt-2 text-3xl font-black text-[#fff1dd]">{value}</div>
          <div className="mt-1 text-xs font-semibold text-[#efcdab]">{footer}</div>
        </div>
      </div>
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

function SummaryPill({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-[#21140d]/70 px-3 py-2">
      <div className="truncate text-[10px] font-black uppercase leading-4 text-[#efcdab]">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-black tabular-nums ${highlight ? 'text-[#ffd99f]' : 'text-[#fff1dd]'}`}>
        {value}
      </div>
    </div>
  );
}

function ItemInfoLine({
  label,
  value,
  item,
  fallback = '📦',
}: {
  label: string;
  value: string;
  item?: Item;
  fallback?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#2b1a12]/70 px-3 py-2">
      <ItemImage item={item} fallback={fallback} />
      <div className="min-w-0">
        <div className="text-[11px] font-black uppercase text-[#f6d7a7]">{label}</div>
        <div className="mt-1 truncate text-sm font-black text-[#fff1dd]">{value}</div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  iconItem,
  iconFallback = '📦',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  iconItem?: Item;
  iconFallback?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
      <div className="flex items-center gap-2">
        {iconItem ? <ItemImage item={iconItem} fallback={iconFallback} /> : null}
        <div className="text-xs font-black uppercase tracking-wide text-[#efcdab]">{label}</div>
      </div>
      <div className="mt-2 grid grid-cols-[36px_1fr_36px] items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 rounded-xl border border-white/15 bg-[#5b3924]/75 text-lg font-black text-[#ffe8ca] transition hover:bg-[#6b452d]/85"
        >
          -
        </button>
        <input
          inputMode="numeric"
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.max(min, next) : min);
          }}
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

function CompactQuantityControl({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="block h-4 whitespace-nowrap text-[10px] font-black uppercase leading-4 text-[#efcdab]">Quantité</span>
      <div className="grid h-9 grid-cols-[2rem_minmax(2.75rem,1fr)_2rem] items-center gap-1.5">
        <button type="button" onClick={onDecrease} className="h-9 rounded-lg border border-white/15 bg-[#5b3924]/75 text-sm font-black text-[#ffe8ca] transition hover:bg-[#6b452d]/85">-</button>
        <div className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#2f1d14]/65 text-sm font-black tabular-nums text-[#fff1dd]">{value}</div>
        <button type="button" onClick={onIncrease} className="h-9 rounded-lg border border-white/15 bg-[#5b3924]/75 text-sm font-black text-[#ffe8ca] transition hover:bg-[#6b452d]/85">+</button>
      </div>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-wide text-[#efcdab]">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(moneyValue(event.target.value))}
        className={INPUT_CLASS}
      />
    </label>
  );
}

function ItemImage({
  item,
  fallback = '📦',
  compact = false,
}: {
  item?: Pick<Item, 'name' | 'image_url' | 'image' | 'icon_url'>;
  fallback?: string;
  compact?: boolean;
}) {
  const src = itemImageUrl(item);
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#3f281b]/70 text-lg ${compact ? 'h-8 w-8 rounded-lg text-xs' : 'h-10 w-10 rounded-xl'}`}>
      {src ? (
        <Image src={src} alt={item?.name ?? 'Item'} width={compact ? 32 : 40} height={compact ? 32 : 40} className="h-full w-full object-cover" unoptimized />
      ) : (
        <span aria-hidden="true">{fallback}</span>
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
          <InfoLine label="Prix kit" value={formatUsd(Number(sale.kit_unit_price ?? 0))} />
          <InfoLine label="Prix disqueuse" value={formatUsd(Number(sale.cutter_unit_price ?? 0))} />
          <InfoLine label="Paiement" value={sale.payment_method === 'cash' ? 'Cash' : 'Bank'} />
          <InfoLine label="Total vente" value={formatUsd(sale.amount_received)} />
          <InfoLine label="Achat objets" value={formatUsd(saleReportedPurchaseTotal(sale))} />
          <InfoLine label="Résultat net" value={formatUsd(saleNetResult(sale))} />
          <InfoLine label="Impact caisse" value={formatUsd(saleCashImpact(sale))} />
          <InfoLine label="Argent groupe" value={`${sale.cash_before != null ? formatUsd(Number(sale.cash_before)) : '-'} -> ${sale.cash_after != null ? formatUsd(Number(sale.cash_after)) : '-'}`} />
          <InfoLine label="Statut" value={statusLabel(sale.status)} />
          <InfoLine label="Date cycle" value={sale.sale_date} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#2f1d14]/65 p-3">
          <div className="text-xs font-black uppercase text-[#efcdab]">Objets rapportés</div>
          <div className="mt-2 space-y-2">
            {sale.reported_items?.map((item) => (
              <div key={`${item.item_id}-${item.item_name}`} className="flex items-center gap-3 text-sm font-semibold text-[#ffe8ca]">
                <ItemImage item={{ name: item.item_name, image_url: item.image_url, image: item.image, icon_url: item.icon_url }} fallback="📦" />
                <span className="min-w-0 flex-1 truncate">{item.item_name}</span>
                <span className="font-black">x{item.quantity} · {formatUsd(moneyValue(item.purchase_unit_price))} · {formatUsd(Number(item.total_purchase ?? Number(item.quantity ?? 0) * moneyValue(item.purchase_unit_price)))}</span>
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
