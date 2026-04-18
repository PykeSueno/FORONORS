import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type ManagedUser = { name: string | null; username: string | null };
type SessionLine = {
  id: number;
  item_id: number | null;
  item_name: string;
  movement_kind: 'buy' | 'sell';
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  items?: { image_url: string | null } | { image_url: string | null }[] | null;
};
type SessionTransaction = {
  id: number;
  counterparty: string | null;
  status?: string | null;
  total_purchases: number | null;
  total_sales: number | null;
  profit_loss: number | null;
  created_at: string;
  four_transaction_lines: SessionLine[] | null;
};
type FourStatsSession = {
  id: number;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  managed_by: string | null;
  summary: Record<string, unknown> | null;
  users: ManagedUser | ManagedUser[] | null;
  four_transactions: SessionTransaction[] | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'four.stats.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: sessions } = await supabase
    .from('four_sessions')
    .select('id, status, opened_at, closed_at, managed_by, users:managed_by(name, username), summary, four_transactions(id, counterparty, status, cancel_reason, created_by, canceled_by, canceled_at, total_purchases, total_sales, profit_loss, created_at, updated_at, four_transaction_lines(id, item_id, item_name, movement_kind, quantity, unit_price, total_amount, items(image_url)))')
    .order('opened_at', { ascending: false })
    .limit(100);

  const byCounterparty: Record<string, { purchases: number; sales: number; count: number }> = {};
  const byMember: Record<string, { sessions: number; profit: number }> = {};
  const byItem: Record<string, { item_id: number | null; image_url: string | null; bought: number; sold: number; volume: number }> = {};
  let totalPurchases = 0;
  let totalSales = 0;
  const sessionRows = (sessions ?? []) as FourStatsSession[];
  const closedSessions = sessionRows.filter((entry) => entry.status === 'closed');

  for (const fourSession of closedSessions) {
    const managedUser = Array.isArray(fourSession.users) ? fourSession.users[0] : fourSession.users;
    const memberName = managedUser?.name || managedUser?.username || 'Inconnu';
    if (!byMember[memberName]) byMember[memberName] = { sessions: 0, profit: 0 };
    byMember[memberName].sessions += 1;

    for (const tx of fourSession.four_transactions ?? []) {
      if (tx.status && tx.status !== 'validated') continue;
      const p = Number(tx.total_purchases ?? 0);
      const s = Number(tx.total_sales ?? 0);
      totalPurchases += p;
      totalSales += s;
      byMember[memberName].profit += Number(tx.profit_loss ?? 0);

      const cp = tx.counterparty?.trim() || 'Non défini';
      if (!byCounterparty[cp]) byCounterparty[cp] = { purchases: 0, sales: 0, count: 0 };
      byCounterparty[cp].purchases += p;
      byCounterparty[cp].sales += s;
      byCounterparty[cp].count += 1;

      for (const line of tx.four_transaction_lines ?? []) {
        const key = line.item_name || `Item #${line.item_id ?? 'N/A'}`;
        if (!byItem[key]) {
          const itemImage = Array.isArray(line.items) ? line.items[0]?.image_url ?? null : line.items?.image_url ?? null;
          byItem[key] = { item_id: line.item_id ?? null, image_url: itemImage, bought: 0, sold: 0, volume: 0 };
        }
        const qty = Number(line.quantity ?? 0);
        if (line.movement_kind === 'buy') byItem[key].bought += qty;
        if (line.movement_kind === 'sell') byItem[key].sold += qty;
        byItem[key].volume += Math.abs(qty);
      }
    }
  }

  const byItemSorted = Object.entries(byItem)
    .sort((a, b) => b[1].volume - a[1].volume || a[0].localeCompare(b[0], 'fr'))
    .map(([name, value]) => ({ name, ...value }));

  return NextResponse.json({
    totals: {
      sessions: closedSessions.length,
      purchases: totalPurchases,
      sales: totalSales,
      profit: totalSales - totalPurchases
    },
    byMember,
    byCounterparty,
    byItem: byItemSorted,
    sessions: closedSessions
  });
}
