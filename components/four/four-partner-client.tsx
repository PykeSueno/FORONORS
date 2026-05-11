'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { getFourPartnerCycleDay, getFourPartnerPreview, getNextOffDay, getNextPartnerDay, toDateKey, type FourPartnerConfig } from '@/lib/four-partner';

type Item = { id: number; name: string; image_url: string | null; quantity: number; category_key?: string | null; type_key?: string | null };
export type FourPartnerSale = {
  id: number;
  sale_date: string;
  partner_name: string;
  kits_sold: number;
  cutters_sold: number;
  amount_received: number;
  payment_method: 'cash' | 'bank';
  status: 'validated' | 'bank_pending' | 'bank_received' | 'canceled';
  reported_items: Array<{ item_id: number; item_name: string; image_url: string | null; quantity: number }>;
  stock_snapshot?: { kits?: { before: number; after: number }; cutters?: { before: number; after: number } };
  cash_before?: number | null;
  cash_after?: number | null;
  created_at: string;
};
type ReportedDraft = { item_id: number; quantity: number };

function normalizeName(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function statusLabel(status: FourPartnerSale['status']) {
  if (status === 'validated') return 'Validé';
  if (status === 'bank_pending') return 'Bank en attente';
  if (status === 'bank_received') return 'Reçu bank';
  return 'Annulé';
}

export function FourPartnerClient({
  config: initialConfig,
  items,
  sales: initialSales,
  canConfig,
  canSell,
  canHistory,
  canStats
}: {
  config: FourPartnerConfig;
  items: Item[];
  sales: FourPartnerSale[];
  canConfig: boolean;
  canSell: boolean;
  canHistory: boolean;
  canStats: boolean;
}) {
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
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [detailSale, setDetailSale] = useState<FourPartnerSale | null>(null);

  const today = useMemo(() => getFourPartnerCycleDay(config, toDateKey()), [config]);
  const preview = useMemo(() => getFourPartnerPreview(config, 7), [config]);
  const nextPartner = useMemo(() => getNextPartnerDay(config), [config]);
  const nextOff = useMemo(() => getNextOffDay(config), [config]);
  const itemById = useMemo(() => new Map(currentItems.map((item) => [item.id, item])), [currentItems]);
  const kitItem = useMemo(() => currentItems.find((item) => normalizeName(item.name).includes('kit')), [currentItems]);
  const cutterItem = useMemo(() => currentItems.find((item) => normalizeName(item.name).includes('disqueuse')), [currentItems]);
  const stockOk = Number(kitItem?.quantity ?? 0) >= 20 && Number(cutterItem?.quantity ?? 0) >= 20;
  const categories = useMemo(() => Array.from(new Set(currentItems.map((item) => item.category_key).filter(Boolean))) as string[], [currentItems]);
  const availableItems = useMemo(() => currentItems
    .filter((item) => !category || item.category_key === category)
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 80), [currentItems, category, query]);

  const stats = useMemo(() => {
    const activeSales = sales.filter((sale) => sale.status !== 'canceled');
    const byPartner = new Map<string, { count: number; kits: number; cutters: number; cash: number; bank: number }>();
    const reportedTotals = new Map<string, number>();
    for (const sale of activeSales) {
      const current = byPartner.get(sale.partner_name) ?? { count: 0, kits: 0, cutters: 0, cash: 0, bank: 0 };
      current.count += 1;
      current.kits += Number(sale.kits_sold ?? 0);
      current.cutters += Number(sale.cutters_sold ?? 0);
      if (sale.payment_method === 'cash') current.cash += Number(sale.amount_received ?? 0);
      if (sale.payment_method === 'bank') current.bank += Number(sale.amount_received ?? 0);
      byPartner.set(sale.partner_name, current);
      for (const item of sale.reported_items ?? []) {
        reportedTotals.set(item.item_name, (reportedTotals.get(item.item_name) ?? 0) + Number(item.quantity ?? 0));
      }
    }
    const respected = activeSales.filter((sale) => getFourPartnerCycleDay(config, sale.sale_date).label === sale.partner_name).length;
    const avgKit = activeSales.length ? activeSales.reduce((sum, sale) => sum + Number(sale.stock_snapshot?.kits?.after ?? 0), 0) / activeSales.length : 0;
    const avgCutter = activeSales.length ? activeSales.reduce((sum, sale) => sum + Number(sale.stock_snapshot?.cutters?.after ?? 0), 0) / activeSales.length : 0;
    return {
      byPartner: Array.from(byPartner.entries()),
      reportedTotals: Array.from(reportedTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
      cash: activeSales.filter((sale) => sale.payment_method === 'cash').reduce((sum, sale) => sum + Number(sale.amount_received ?? 0), 0),
      bank: activeSales.filter((sale) => sale.payment_method === 'bank').reduce((sum, sale) => sum + Number(sale.amount_received ?? 0), 0),
      offDays: preview.filter((day) => day.isOff).length,
      respectRate: activeSales.length ? Math.round((respected / activeSales.length) * 100) : 0,
      avgStock: { kit: avgKit, cutter: avgCutter }
    };
  }, [sales, config, preview]);

  function addReportedItem(itemId: number) {
    setReported((current) => {
      const index = current.findIndex((entry) => entry.item_id === itemId);
      if (index >= 0) return current.map((entry, idx) => idx === index ? { ...entry, quantity: entry.quantity + 1 } : entry);
      return [...current, { item_id: itemId, quantity: 1 }];
    });
  }

  function applyPayload(payload: { sale?: FourPartnerSale; itemUpdates?: Array<{ id: number; quantity: number }> }) {
    if (payload.itemUpdates?.length) {
      setCurrentItems((current) => current.map((item) => {
        const update = payload.itemUpdates?.find((entry) => entry.id === item.id);
        return update ? { ...item, quantity: update.quantity } : item;
      }));
    }
    if (payload.sale) {
      setSales((current) => [payload.sale as FourPartnerSale, ...current.filter((sale) => sale.id !== payload.sale?.id)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
  }

  async function saveConfig() {
    setError('');
    const res = await fetch('/api/four/partner', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configDraft)
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message ?? 'Sauvegarde impossible.');
    setConfig(data.config);
    setConfigDraft(data.config);
  }

  async function submitSale() {
    setError('');
    const res = await fetch('/api/four/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_date: today.date,
        partner_name: today.label,
        kits_sold: kitsSold,
        cutters_sold: cuttersSold,
        amount_received: amountReceived,
        payment_method: paymentMethod,
        reported_items: reported
      })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message ?? 'Vente impossible.');
    applyPayload(data);
    setReported([]);
    setAmountReceived(0);
  }

  async function markBankReceived(saleId: number) {
    const res = await fetch('/api/four/partner', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sale_id: saleId }) });
    const data = await res.json();
    if (!res.ok) return setError(data.message ?? 'Action impossible.');
    applyPayload(data);
  }

  async function cancelSale(saleId: number) {
    const reason = window.prompt('Raison annulation') || 'Erreur de saisie';
    const res = await fetch('/api/four/partner', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sale_id: saleId, reason }) });
    const data = await res.json();
    if (!res.ok) return setError(data.message ?? 'Annulation impossible.');
    applyPayload(data);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr_.9fr]">
        <article className="glass-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#efcdab]">Cycle partenaire</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[config.partner_one, config.partner_two, config.partner_three, config.off_label].map((label, index) => (
              <div key={`${label}-${index}`} className={`rounded-xl border p-2 text-center ${today.position === index + 1 ? 'border-amber-200/70 bg-amber-400/15' : 'border-white/10 bg-[#3b2418]/50'}`}>
                <p className="text-[11px] text-[#efcdab]">J{index + 1}</p>
                <p className="truncate text-sm font-semibold text-[#ffe8ca]">{label}</p>
              </div>
            ))}
          </div>
          {canConfig ? (
            <div className="mt-4 space-y-2">
              <input className="saas-input w-full" value={configDraft.partner_one} onChange={(e) => setConfigDraft((cur) => ({ ...cur, partner_one: e.target.value }))} placeholder="Partenaire 1" />
              <input className="saas-input w-full" value={configDraft.partner_two} onChange={(e) => setConfigDraft((cur) => ({ ...cur, partner_two: e.target.value }))} placeholder="Partenaire 2" />
              <input className="saas-input w-full" value={configDraft.partner_three} onChange={(e) => setConfigDraft((cur) => ({ ...cur, partner_three: e.target.value }))} placeholder="Partenaire 3" />
              <div className="grid grid-cols-2 gap-2">
                <input className="saas-input w-full" value={configDraft.off_label} onChange={(e) => setConfigDraft((cur) => ({ ...cur, off_label: e.target.value }))} placeholder="Jour off" />
                <input className="saas-input w-full" type="date" value={configDraft.cycle_start_date} onChange={(e) => setConfigDraft((cur) => ({ ...cur, cycle_start_date: e.target.value }))} />
              </div>
              <button className="saas-primary-btn w-full" onClick={() => void saveConfig()}>Enregistrer</button>
            </div>
          ) : null}
        </article>

        <article className="glass-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#efcdab]">Aujourd’hui</p>
          <h2 className="mt-2 text-3xl font-semibold text-[#fff1dd]">{today.label}</h2>
          {today.isOff ? (
            <div className="mt-4 rounded-xl border border-sky-200/20 bg-sky-500/10 p-3 text-sm text-[#dcefff]">
              <p className="font-semibold">Objectif day-off</p>
              <p>Refaire les stocks. Pas de vente partenaire aujourd’hui.</p>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <StockCard label="Kits à vendre" expected={20} current={Number(kitItem?.quantity ?? 0)} image={kitItem?.image_url ?? null} />
                <StockCard label="Disqueuses à vendre" expected={20} current={Number(cutterItem?.quantity ?? 0)} image={cutterItem?.image_url ?? null} />
              </div>
              <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${stockOk ? 'border-emerald-200/25 bg-emerald-500/10 text-[#d7f6d0]' : 'border-red-200/30 bg-red-500/10 text-red-100'}`}>
                {stockOk ? '✅ Stock OK' : '❌ Stock insuffisant'}
              </p>
            </>
          )}
          <div className="mt-3 grid gap-2 text-xs text-[#efcdab] sm:grid-cols-2">
            <p className="rounded-lg border border-white/10 bg-[#3b2418]/45 p-2">Prochain partenaire<br /><span className="text-sm font-semibold text-[#ffe8ca]">{nextPartner ? `${nextPartner.label} · ${new Date(nextPartner.date).toLocaleDateString('fr-FR')}` : '-'}</span></p>
            <p className="rounded-lg border border-white/10 bg-[#3b2418]/45 p-2">Prochain day-off<br /><span className="text-sm font-semibold text-[#ffe8ca]">{nextOff ? new Date(nextOff.date).toLocaleDateString('fr-FR') : '-'}</span></p>
          </div>
        </article>

        <article className="glass-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#efcdab]">7 prochains jours</p>
          <div className="mt-3 space-y-2">
            {preview.map((day) => (
              <div key={day.date} className={`grid grid-cols-[90px_1fr] rounded-lg border px-3 py-2 text-sm ${day.isOff ? 'border-sky-200/20 bg-sky-500/10' : 'border-white/10 bg-[#3b2418]/50'}`}>
                <span className="text-[#efcdab]">{new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                <span className="truncate font-semibold text-[#ffe8ca]">{day.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {error ? <p className="rounded-xl border border-red-200/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      {!today.isOff && canSell ? (
        <section className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Vente partenaire</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className="saas-input" value={today.label} readOnly />
              <input className="saas-input" type="number" value={amountReceived} onChange={(e) => setAmountReceived(Math.max(0, Number(e.target.value || 0)))} placeholder="Prix total reçu" />
              <Stepper label="Kits vendus" value={kitsSold} setValue={setKitsSold} />
              <Stepper label="Disqueuses vendues" value={cuttersSold} setValue={setCuttersSold} />
            </div>
            <div className="mt-3 flex gap-2">
              <button className={`filter-pill ${paymentMethod === 'cash' ? 'filter-pill-active' : ''}`} onClick={() => setPaymentMethod('cash')}>Cash</button>
              <button className={`filter-pill ${paymentMethod === 'bank' ? 'filter-pill-active' : ''}`} onClick={() => setPaymentMethod('bank')}>Bank</button>
            </div>
            <button className="saas-primary-btn mt-4 w-full" onClick={() => void submitSale()}>Valider vente partenaire</button>
          </article>

          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Objets rapportés</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input className="saas-input" placeholder="Rechercher item" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="saas-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Toutes catégories</option>
                {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </div>
            <div className="mt-3 grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
              {availableItems.map((item) => (
                <button key={item.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#3b2418]/55 p-2 text-left" onClick={() => addReportedItem(item.id)}>
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#1f120d]">{item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#ffe8ca]">{item.name}</p><p className="text-xs text-[#efcdab]">Stock {item.quantity}</p></div>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {reported.map((line, index) => {
                const item = itemById.get(line.item_id);
                if (!item) return null;
                return (
                  <div key={`${line.item_id}-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2f1d14]/60 p-2">
                    <span className="flex-1 text-sm text-[#ffe8ca]">{item.name}</span>
                    <input className="saas-input w-20 text-center" value={line.quantity} onChange={(e) => setReported((cur) => cur.map((entry, idx) => idx === index ? { ...entry, quantity: Math.max(1, Number(e.target.value || 1)) } : entry))} />
                    <button className="saas-ghost-btn !px-2" onClick={() => setReported((cur) => cur.filter((_, idx) => idx !== index))}>×</button>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        {canHistory ? (
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Historique partenaire</h3>
            <div className="mt-3 space-y-2">
              {sales.slice(0, 12).map((sale) => (
                <div key={sale.id} className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-semibold text-[#ffe8ca]">#{sale.id} · {sale.partner_name} · {new Date(sale.sale_date).toLocaleDateString('fr-FR')}</p>
                      <p className="text-xs text-[#efcdab]">{sale.kits_sold} kits · {sale.cutters_sold} disqueuses · {formatUsd(Number(sale.amount_received))} · {sale.payment_method.toUpperCase()} · {statusLabel(sale.status)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="saas-ghost-btn !px-3 !py-1 text-xs" onClick={() => setDetailSale(sale)}>Détail</button>
                      {sale.status === 'bank_pending' && canSell ? <button className="saas-ghost-btn !px-3 !py-1 text-xs" onClick={() => void markBankReceived(sale.id)}>Bank reçu</button> : null}
                      {sale.status !== 'canceled' && canSell ? <button className="saas-ghost-btn !px-3 !py-1 text-xs" onClick={() => void cancelSale(sale.id)}>Annuler</button> : null}
                    </div>
                  </div>
                </div>
              ))}
              {sales.length === 0 ? <p className="text-sm text-[#efcdab]">Aucune vente partenaire.</p> : null}
            </div>
          </article>
        ) : null}

        {canStats ? (
          <article className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">Stats partenaire</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MiniStat label="Cash total" value={formatUsd(stats.cash)} />
              <MiniStat label="Bank total" value={formatUsd(stats.bank)} />
              <MiniStat label="Jours off aperçu" value={String(stats.offDays)} />
              <MiniStat label="Respect cycle" value={`${stats.respectRate}%`} />
              <MiniStat label="Stock moyen kits" value={stats.avgStock.kit.toFixed(1)} />
              <MiniStat label="Stock moyen disqueuses" value={stats.avgStock.cutter.toFixed(1)} />
            </div>
            <div className="mt-3 space-y-2">
              {stats.byPartner.map(([partner, row]) => (
                <div key={partner} className="rounded-lg border border-white/10 bg-[#2f1d14]/55 p-2 text-xs text-[#efcdab]">
                  <p className="font-semibold text-[#ffe8ca]">{partner}</p>
                  <p>{row.count} ventes · {row.kits} kits · {row.cutters} disqueuses · Cash {formatUsd(row.cash)} · Bank {formatUsd(row.bank)}</p>
                </div>
              ))}
              {stats.reportedTotals.length > 0 ? <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-[#efcdab]">Objets rapportés</p> : null}
              {stats.reportedTotals.map(([name, qty]) => <p key={name} className="text-xs text-[#efcdab]">{name}: x{qty}</p>)}
            </div>
          </article>
        ) : null}
      </section>

      {detailSale ? <SaleDetail sale={detailSale} onClose={() => setDetailSale(null)} /> : null}
    </div>
  );
}

function StockCard({ label, expected, current, image }: { label: string; expected: number; current: number; image: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
      <div className="flex items-center gap-2">
        <div className="h-11 w-11 overflow-hidden rounded-lg bg-[#1f120d]">{image ? <Image src={image} alt={label} width={44} height={44} className="h-full w-full object-cover" unoptimized /> : null}</div>
        <div>
          <p className="text-sm font-semibold text-[#ffe8ca]">{label}</p>
          <p className="text-xs text-[#efcdab]">Stock {current} / {expected}</p>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, setValue }: { label: string; value: number; setValue: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-[#efcdab]">{label}</span>
      <div className="mt-1 grid grid-cols-[38px_1fr_38px] gap-2">
        <button className="saas-ghost-btn !px-0" onClick={() => setValue(Math.max(0, value - 1))}>-</button>
        <input className="saas-input text-center" value={value} onChange={(e) => setValue(Math.max(0, Number(e.target.value || 0)))} />
        <button className="saas-ghost-btn !px-0" onClick={() => setValue(value + 1)}>+</button>
      </div>
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-[#3b2418]/50 p-3"><p className="text-xs text-[#efcdab]">{label}</p><p className="text-lg font-semibold text-[#ffe8ca]">{value}</p></div>;
}

function SaleDetail({ sale, onClose }: { sale: FourPartnerSale; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-card max-h-[85vh] w-full max-w-2xl overflow-auto p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-[#fff1dd]">Détail vente partenaire #{sale.id}</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-[#efcdab] sm:grid-cols-2">
          <p>Partenaire: <span className="text-[#ffe8ca]">{sale.partner_name}</span></p>
          <p>Date: {new Date(sale.sale_date).toLocaleDateString('fr-FR')}</p>
          <p>Kits: {sale.kits_sold}</p>
          <p>Disqueuses: {sale.cutters_sold}</p>
          <p>Argent: {formatUsd(Number(sale.amount_received))}</p>
          <p>Paiement: {sale.payment_method.toUpperCase()} · {statusLabel(sale.status)}</p>
          <p>Caisse: {formatUsd(Number(sale.cash_before ?? 0))} → {formatUsd(Number(sale.cash_after ?? 0))}</p>
        </div>
        <h4 className="mt-4 text-sm font-semibold text-[#ffe8ca]">Objets rapportés</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(sale.reported_items ?? []).map((item) => (
            <div key={`${sale.id}-${item.item_id}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2f1d14]/55 p-2">
              <div className="h-9 w-9 overflow-hidden rounded-md bg-[#1f120d]">{item.image_url ? <Image src={item.image_url} alt={item.item_name} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : null}</div>
              <p className="text-sm text-[#efcdab]">{item.item_name} x{item.quantity}</p>
            </div>
          ))}
          {(sale.reported_items ?? []).length === 0 ? <p className="text-sm text-[#efcdab]">Aucun objet rapporté.</p> : null}
        </div>
      </div>
    </div>
  );
}
