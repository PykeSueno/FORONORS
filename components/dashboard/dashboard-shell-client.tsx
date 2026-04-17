'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { formatUsd } from '@/lib/currency';
import { humanMoneyMovementLabel, humanStockMovementLabel, moneyMovementIcon, stockMovementIcon } from '@/lib/labels';
import { WelcomeCardActions } from '@/components/dashboard/welcome-card-actions';
import { DashboardHubGrid } from '@/components/dashboard/dashboard-hub-grid';

type Card = { id: string; href: string; enabled: boolean; icon: string; title: string; value: string; subtitle: string };
type DashboardFlags = {
  canMoneyAccess: boolean; canMoneyPreview: boolean;
  canItemsAccess: boolean; canItemsPreview: boolean;
  canTransactionsAccess: boolean; canTransactionsPreview: boolean;
  canTransactionsRecentAccess: boolean; canTransactionsRecentPreview: boolean;
  canMembersAccess: boolean; canMembersPreview: boolean;
  canLogsAccess: boolean; canLogsPreview: boolean;
  canTabletAccess: boolean; canTabletPreview: boolean;
  canActivityAccess: boolean; canActivityPreview: boolean;
  canFourAccess: boolean; canFourPreview: boolean;
  canDrugsAccess: boolean; canDrugsPreview: boolean;
  canSaleObjectsAccess: boolean; canSaleObjectsPreview: boolean;
  canMoneyMovementsView: boolean; canStockMovementsView: boolean;
};

type SummaryPayload = {
  canShowMoneyMovements: boolean;
  canShowStockMovements: boolean;
  moneyItemImageUrl: string | null;
  values: { cashBalance: number; itemsCount: number; txCount: number; membersCount: number; logsCount: number; fourOpen: boolean; saleObjectsToday: number };
  recentCash: Array<{ type: string; amount: number; label: string; created_at: string; users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null }>;
  recentStock: Array<{ item_id?: number | null; item_name: string; quantity_delta: number; transaction_type: string; created_at: string; users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null; items?: { image_url: string | null } | { image_url: string | null }[] | null }>;
};


export function DashboardShellClient({ name, role, canUpdatePassword, initialOrder, flags }: { name: string; role: string; canUpdatePassword: boolean; initialOrder: string[]; flags: DashboardFlags }) {
  const [summary, setSummary] = useState<SummaryPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/dashboard/summary', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) setSummary(data as SummaryPayload); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const cards = useMemo<Card[]>(() => [
    flags.canMoneyPreview ? { id: 'money', href: '/dashboard/argent', enabled: flags.canMoneyAccess, icon: '💰', title: 'Argent', value: summary ? formatUsd(summary.values.cashBalance) : '…', subtitle: 'Caisse actuelle' } : null,
    flags.canSaleObjectsPreview ? { id: 'sale_objects', href: '/dashboard/vente-objets', enabled: flags.canSaleObjectsAccess, icon: '🧰', title: 'Vente objets', value: summary ? String(summary.values.saleObjectsToday) : '…', subtitle: 'Vendre les objets du groupe' } : null,
    flags.canItemsPreview ? { id: 'items', href: '/dashboard/items', enabled: flags.canItemsAccess, icon: '📦', title: 'Items', value: summary ? String(summary.values.itemsCount) : '…', subtitle: 'Total catalogué' } : null,
    flags.canTransactionsPreview ? { id: 'transactions', href: '/dashboard/transactions', enabled: flags.canTransactionsAccess, icon: '🔄', title: 'Transactions', value: summary ? String(summary.values.txCount) : '…', subtitle: 'Créer, gérer, vente objets' } : null,
    flags.canTransactionsRecentPreview ? { id: 'transactions_recent', href: '/dashboard/transactions-recentes', enabled: flags.canTransactionsRecentAccess, icon: '🕒', title: 'Transactions récentes', value: summary ? String(summary.values.txCount) : '…', subtitle: 'Historique' } : null,
    flags.canMembersPreview ? { id: 'members', href: '/dashboard/membres', enabled: flags.canMembersAccess, icon: '👥', title: 'Membres', value: summary ? String(summary.values.membersCount) : '…', subtitle: 'Gestion équipe' } : null,
    flags.canLogsPreview ? { id: 'logs', href: '/dashboard/logs', enabled: flags.canLogsAccess, icon: '🧾', title: 'Logs', value: summary ? String(summary.values.logsCount) : '…', subtitle: 'Traçabilité' } : null,
    flags.canTabletPreview ? { id: 'tablet', href: '/dashboard/tablette', enabled: flags.canTabletAccess, icon: '📱', title: 'Tablette', value: 'Module', subtitle: 'Passages 8h → 8h' } : null,
    flags.canActivityPreview ? { id: 'activity', href: '/dashboard/activite', enabled: flags.canActivityAccess, icon: '🎯', title: 'Activité', value: 'Module', subtitle: 'Boîte / Cambriolage / Conteneur' } : null,
    flags.canFourPreview ? { id: 'four', href: '/dashboard/four', enabled: flags.canFourAccess, icon: '🔥', title: 'FOUR', value: summary ? (summary.values.fourOpen ? 'Ouvert' : 'Fermé') : '…', subtitle: 'Session vente / achat' } : null,
    flags.canDrugsPreview ? { id: 'drugs', href: '/dashboard/drogues', enabled: flags.canDrugsAccess, icon: '🧪', title: 'Drogues', value: 'Module', subtitle: 'Transfo + vente + production' } : null
  ].filter(Boolean) as Card[], [flags, summary]);

  const stockRows = useMemo(() => (summary?.recentStock ?? []).map((row) => ({
    created_at: row.created_at,
    member: Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username) || 'Groupe',
    description: `${humanStockMovementLabel(row.transaction_type)} — ${row.item_name}`,
    value: `${row.quantity_delta > 0 ? '+' : ''}${row.quantity_delta}`,
    quantity: row.quantity_delta,
    type: row.transaction_type,
    item: row.item_name,
    image: Array.isArray(row.items) ? row.items[0]?.image_url : row.items?.image_url
  })).slice(0, 4), [summary]);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[#f6e5cd]">Bienvenue {name}</h1>
            <p className="mt-1 text-sm text-[#f1d2ae]">Grade: {role || 'Utilisateur'}</p>
          </div>
          <WelcomeCardActions canUpdatePassword={canUpdatePassword} />
        </div>
      </section>

      <DashboardHubGrid cards={cards} initialOrder={initialOrder} />

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
                  <p>Type: {humanMoneyMovementLabel(row.type)}</p>
                  <p>Montant: {formatUsd(Number(row.amount))}</p>
                  <p>Libellé: {row.label}</p>
                  <p>Utilisateur: {(Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe'}</p>
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
                  <p>Type: {humanStockMovementLabel(row.type)}</p>
                  <p>Item: {row.item}</p>
                  <p>Quantité: {row.quantity > 0 ? '+' : ''}{row.quantity}</p>
                  <p>Utilisateur: {row.member}</p>
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
