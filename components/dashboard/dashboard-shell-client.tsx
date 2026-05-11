'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { formatUsd } from '@/lib/currency';
import { humanMoneyMovementLabel, humanStockMovementLabel, moneyMovementIcon, stockMovementIcon } from '@/lib/labels';
import { WelcomeCardActions } from '@/components/dashboard/welcome-card-actions';
import { DashboardHubGrid } from '@/components/dashboard/dashboard-hub-grid';

type Card = { id: string; href: string; enabled: boolean; icon: ReactNode; title: string; value: string; subtitle: string };
type DashboardFlags = {
  canMoneyAccess: boolean; canMoneyPreview: boolean;
  canItemsAccess: boolean; canItemsPreview: boolean;
  canTransactionsAccess: boolean; canTransactionsPreview: boolean;
  canTransactionsRecentAccess: boolean; canTransactionsRecentPreview: boolean;
  canMembersAccess: boolean; canMembersPreview: boolean;
  canActivityPayrollAccess: boolean; canActivityPayrollPreview: boolean;
  canExpensesAccess: boolean; canExpensesPreview: boolean;
  canLogsAccess: boolean; canLogsPreview: boolean;
  canTabletCigaretteAccess: boolean; canTabletCigarettePreview: boolean;
  canActivityAccess: boolean; canActivityPreview: boolean;
  canFourAccess: boolean; canFourPreview: boolean;
  canDrugsAccess: boolean; canDrugsPreview: boolean;
  canRobberiesAccess: boolean; canRobberiesPreview: boolean;
  canSaleObjectsAccess: boolean; canSaleObjectsPreview: boolean;
  canMoneyMovementsView: boolean; canStockMovementsView: boolean;
};

type SummaryPayload = {
  canShowMoneyMovements: boolean;
  canShowStockMovements: boolean;
  moneyItemImageUrl: string | null;
  values: { cashBalance: number; expensesPendingTotal: number; itemsCount: number; txCount: number; membersCount: number; logsCount: number; saleObjectsToday: number; tabletPassagesToday: number; processorOperationsToday: number; activitiesToday: number; cigarettePassagesToday: number; cigaretteRevenueToday: number; fourPurchasesToday: number; fourSalesToday: number; fourProfitToday: number };
  recentCash: Array<{ type: string; amount: number; label: string; created_at: string; users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null }>;
  recentStock: Array<{ item_id?: number | null; item_name: string; quantity_delta: number; transaction_type: string; created_at: string; users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null; items?: { image_url: string | null; quantity?: number | null } | { image_url: string | null; quantity?: number | null }[] | null }>;
};

function OpsDashboardIcon() {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/35 bg-gradient-to-br from-[#6c4026] via-[#4b2c1d] to-[#2a170f] shadow-inner shadow-black/20">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7.5h16v9H4z" fill="#3b2418" stroke="#f4c56f" />
        <path d="M7 7.5V5.75A1.75 1.75 0 0 1 8.75 4h6.5A1.75 1.75 0 0 1 17 5.75V7.5" stroke="#f7dfaa" />
        <path d="M8 12h3" stroke="#67e8f9" />
        <path d="M15 11.5h1.5" stroke="#86efac" />
        <path d="M15 14.5h1.5" stroke="#fca5a5" />
        <path d="M6.5 19h11" stroke="#f7dfaa" />
      </svg>
    </span>
  );
}


export function DashboardShellClient({ name, role, payEstimateCurrent, payEstimatePrevious, canUpdatePassword, initialOrder, flags }: { name: string; role: string; payEstimateCurrent: number; payEstimatePrevious: number; canUpdatePassword: boolean; initialOrder: string[]; flags: DashboardFlags }) {
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [payEstimate, setPayEstimate] = useState({ current: payEstimateCurrent, previous: payEstimatePrevious });

  useEffect(() => {
    const controller = new AbortController();
    const summaryRequest = fetch('/api/dashboard/summary', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) setSummary(data as SummaryPayload); })
      .catch(() => {});
    const payrollRequest = flags.canActivityPayrollPreview
      ? fetch('/api/dashboard/payroll-preview', { cache: 'no-store', signal: controller.signal })
          .then((response) => response.ok ? response.json() : null)
          .then((data) => { if (data) setPayEstimate({ current: Number(data.currentEstimate ?? 0), previous: Number(data.previousEstimate ?? 0) }); })
          .catch(() => {})
      : Promise.resolve();
    void Promise.all([summaryRequest, payrollRequest]);
    return () => controller.abort();
  }, [flags.canActivityPayrollPreview]);

  const cards = useMemo<Card[]>(() => [
    flags.canMoneyPreview ? { id: 'money', href: '/dashboard/argent', enabled: flags.canMoneyAccess, icon: '💰', title: 'Argent', value: summary ? formatUsd(summary.values.cashBalance) : '…', subtitle: 'Caisse actuelle' } : null,
    flags.canSaleObjectsPreview ? { id: 'sale_objects', href: '/dashboard/vente-objets', enabled: flags.canSaleObjectsAccess, icon: '🧰', title: 'Vente objets', value: summary ? String(summary.values.saleObjectsToday) : '…', subtitle: 'Vendre les objets du groupe' } : null,
    flags.canItemsPreview ? { id: 'items', href: '/dashboard/items', enabled: flags.canItemsAccess, icon: '📦', title: 'Items', value: summary ? String(summary.values.itemsCount) : '…', subtitle: 'Stock total' } : null,
    flags.canTransactionsPreview ? { id: 'transactions', href: '/dashboard/transactions', enabled: flags.canTransactionsAccess, icon: '🔄', title: 'Transactions', value: summary ? String(summary.values.txCount) : '…', subtitle: 'Entrées / Sorties / Historique' } : null,
    flags.canTransactionsRecentPreview ? { id: 'transactions_recent', href: '/dashboard/transactions-recentes', enabled: flags.canTransactionsRecentAccess, icon: '🕒', title: 'Transactions récentes', value: summary ? String(summary.values.txCount) : '…', subtitle: 'Historique' } : null,
    flags.canMembersPreview ? { id: 'members', href: '/dashboard/membres', enabled: flags.canMembersAccess, icon: '👥', title: 'Membres', value: summary ? String(summary.values.membersCount) : '…', subtitle: 'Gestion équipe' } : null,
    flags.canActivityPayrollPreview ? { id: 'activity_payroll', href: '/dashboard/activites-payes', enabled: flags.canActivityPayrollAccess, icon: <OpsDashboardIcon />, title: 'Activités & Payes & Dépenses', value: summary ? String(summary.values.activitiesToday) : '...', subtitle: 'Activités / Payes / Dépenses / Logs' } : null,
    flags.canLogsPreview ? { id: 'logs', href: '/dashboard/logs', enabled: flags.canLogsAccess, icon: '🧾', title: 'Logs', value: summary ? String(summary.values.logsCount) : '…', subtitle: 'Traçabilité' } : null,
    flags.canTabletCigarettePreview ? { id: 'tablet_cigarette', href: '/dashboard/travail', enabled: flags.canTabletCigaretteAccess, icon: '🛠️', title: 'Jobs', value: summary ? String(summary.values.tabletPassagesToday + summary.values.cigarettePassagesToday + summary.values.processorOperationsToday) : '…', subtitle: summary ? 'Tablette / Cigarette / Processeur / Pierre' : 'Tablette / Cigarette / Processeur / Pierre' } : null,
    flags.canActivityPreview ? { id: 'activity', href: '/dashboard/activite', enabled: flags.canActivityAccess, icon: '🎯', title: 'Activité', value: summary ? String(summary.values.activitiesToday) : '0', subtitle: 'Boîte / Cambriolage / Conteneur / Cargo / Garage / Processeur' } : null,
    flags.canFourPreview ? { id: 'four', href: '/dashboard/four', enabled: flags.canFourAccess, icon: '🔥', title: 'FOUR', value: summary ? formatUsd(summary.values.fourProfitToday) : '…', subtitle: summary ? `${formatUsd(summary.values.fourPurchasesToday)} achat / ${formatUsd(summary.values.fourSalesToday)} vente` : 'Achat / Vente' } : null,
    flags.canDrugsPreview ? { id: 'drugs', href: '/dashboard/drogues', enabled: flags.canDrugsAccess, icon: '🧪', title: 'Drogues', value: 'Module', subtitle: 'Transfo / Vente / Production / GoFast' } : null
    , flags.canRobberiesPreview ? { id: 'robberies', href: '/dashboard/braquage', enabled: flags.canRobberiesAccess, icon: '🥷', title: 'Braquage', value: 'Module', subtitle: 'Fleeca / Bijouterie / Morgue' } : null
  ].filter(Boolean) as Card[], [flags, summary]);

  const expenseCard: Card | null = null;
  const hubCards = expenseCard ? [...cards, expenseCard] : cards;

  const stockRows = useMemo(() => {
    const runningAfterByItem = new Map<number, number>();
    return (summary?.recentStock ?? []).map((row) => {
      const itemPayload = Array.isArray(row.items) ? row.items[0] : row.items;
      const itemId = Number(row.item_id ?? 0);
      let after: number | null = null;
      let before: number | null = null;

      if (itemId > 0) {
        const knownAfter = runningAfterByItem.has(itemId) ? runningAfterByItem.get(itemId) : Number(itemPayload?.quantity ?? NaN);
        if (Number.isFinite(knownAfter)) {
          after = Number(knownAfter);
          before = after - Number(row.quantity_delta ?? 0);
          runningAfterByItem.set(itemId, before);
        }
      }

      return {
        created_at: row.created_at,
        member: Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username) || 'Groupe',
        description: `${humanStockMovementLabel(row.transaction_type)} — ${row.item_name}`,
        value: `${row.quantity_delta > 0 ? '+' : ''}${row.quantity_delta}`,
        quantity: row.quantity_delta,
        type: row.transaction_type,
        item: row.item_name,
        image: itemPayload?.image_url,
        before,
        after
      };
    }).slice(0, 4);
  }, [summary]);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-[#f6e5cd]">Bienvenue {name}</h1>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#2f1c13]/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#e7c39b]">🛡️ Grade</p>
                <p className="text-sm font-semibold text-[#fff0dc]">{role || 'Utilisateur'}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#d9f5d4]">💸 Salaire estimé semaine</p>
                <p className="text-base font-semibold text-[#ecffe8]">{formatUsd(payEstimate.current)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#2f1c13]/55 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#e7c39b]">📊 Semaine passée</p>
                <p className="text-sm font-medium text-[#f9dfbe]">{formatUsd(payEstimate.previous)}</p>
              </div>
            </div>
          </div>
          <WelcomeCardActions canUpdatePassword={canUpdatePassword} />
        </div>
      </section>

      <DashboardHubGrid cards={hubCards} initialOrder={initialOrder} />

      <section className="grid gap-4 lg:grid-cols-2">
        {summary?.canShowMoneyMovements ? <article className="glass-card p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements d’argent</h2>{flags.canMoneyMovementsView ? <Link href="/dashboard/mouvements/argent" className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3] hover:bg-[#5a3926]">💰 Cash</Link> : <span className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3]">💰 Cash</span>}</div>
          <div className="space-y-2">
            {summary.recentCash.slice(0, 4).map((row, idx) => (
              <div key={idx} className="group relative rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4a2f20]/70 text-sm">{moneyMovementIcon(row.type)}</span>
                    <p className="text-sm font-medium text-[#ffe8c9]"> {(Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe'} — {humanMoneyMovementLabel(row.type)} — {row.label}</p>
                  </div>
                  <p className={`text-sm font-semibold ${Number(row.amount) >= 0 ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{formatUsd(Number(row.amount))}</p>
                </div>
                <p className="mt-1 text-xs text-[#f2d2ae]">{new Date(row.created_at).toLocaleString('fr-FR')}</p>
                <div className="pointer-events-none absolute left-3 top-full z-20 mt-1 hidden min-w-64 rounded-xl border border-white/10 bg-[#2a180f]/95 p-3 text-xs text-[#f2d2ae] shadow-xl group-hover:block">
                  <p className="font-semibold text-[#ffe8c9]">Détail mouvement</p>
                  <p>🏷️ Type: {humanMoneyMovementLabel(row.type)}</p>
                  <p>💰 Montant: {formatUsd(Number(row.amount))}</p>
                  <p>🧾 Libellé: {row.label}</p>
                  <p>👤 Utilisateur: {(Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe'}</p>
                  <p>🕒 Date: {new Date(row.created_at).toLocaleString('fr-FR')}</p>
                  {summary?.moneyItemImageUrl ? (
                    <div className="relative mt-2 h-12 w-12">
                      <Image src={summary.moneyItemImageUrl} alt="Argent" width={48} height={48} className="h-12 w-12 rounded-md border border-white/10 object-cover" unoptimized />
                      
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article> : null}

        {summary?.canShowStockMovements ? <article className="glass-card p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#f6e5cd]">Derniers mouvements de stock</h2>{flags.canStockMovementsView ? <Link href="/dashboard/mouvements/stock" className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3] hover:bg-[#5a3926]">📦 Stock</Link> : <span className="rounded-full bg-[#3b2418]/70 px-2 py-1 text-xs text-[#f6d6b3]">📦 Stock</span>}</div>
          <div className="space-y-2">
            {stockRows.map((row, idx) => (
              <div key={idx} className="group relative rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4a2f20]/70 text-sm">{stockMovementIcon(row.type, row.quantity)}</span>
                    <p className="text-sm font-medium text-[#ffe8c9]">{row.member} — {row.description}</p>
                  </div>
                  <p className={`text-sm font-semibold ${row.value.startsWith('+') ? 'text-[#bff0b9]' : 'text-[#f0b9b9]'}`}>{row.value}</p>
                </div>
                <p className="mt-1 text-xs text-[#f2d2ae]">{new Date(row.created_at).toLocaleString('fr-FR')}</p>
                <div className="pointer-events-none absolute left-3 top-full z-20 mt-1 hidden min-w-64 rounded-xl border border-white/10 bg-[#2a180f]/95 p-3 text-xs text-[#f2d2ae] shadow-xl group-hover:block">
                  <p className="font-semibold text-[#ffe8c9]">Détail mouvement</p>
                  <p>🏷️ Type: {humanStockMovementLabel(row.type)}</p>
                  <p>📦 Item: {row.item}</p>
                  <p>📊 Avant / Après: {row.before != null ? row.before : '—'} → {row.after != null ? row.after : '—'}</p>
                  <p>📈 Variation: {row.quantity > 0 ? '+' : ''}{row.quantity}</p>
                  <p>👤 Utilisateur: {row.member}</p>
                  <p>🕒 Date: {new Date(row.created_at).toLocaleString('fr-FR')}</p>
                  {row.image ? (
                    <div className="relative mt-2 h-12 w-12">
                      <Image src={row.image} alt={row.item} width={48} height={48} className="h-12 w-12 rounded-md border border-white/10 object-cover" unoptimized />
                      
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article> : null}
      </section>
    </div>
  );
}
