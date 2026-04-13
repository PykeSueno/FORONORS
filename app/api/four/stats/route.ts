import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'four.stats.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('four_movements')
    .select('movement_kind, item_name, quantity, total_amount, counterparty, created_at, four_sessions(status)');

  const rows = data ?? [];
  const counterpartyTotals: Record<string, { sales: number; purchases: number }> = {};
  const itemSold: Record<string, number> = {};
  let totalSales = 0;
  let totalPurchases = 0;

  for (const row of rows as Array<{ movement_kind: string; item_name: string | null; quantity: number; total_amount: number; counterparty: string | null; created_at: string }>) {
    const cp = row.counterparty?.trim() || 'Non défini';
    if (!counterpartyTotals[cp]) counterpartyTotals[cp] = { sales: 0, purchases: 0 };

    if (row.movement_kind === 'sell') {
      counterpartyTotals[cp].sales += Number(row.total_amount ?? 0);
      totalSales += Number(row.total_amount ?? 0);
      if (row.item_name) itemSold[row.item_name] = (itemSold[row.item_name] ?? 0) + Number(row.quantity ?? 0);
    }

    if (row.movement_kind === 'buy') {
      counterpartyTotals[cp].purchases += Number(row.total_amount ?? 0);
      totalPurchases += Number(row.total_amount ?? 0);
    }
  }

  return NextResponse.json({
    totals: {
      sessions: rows.length,
      sales: totalSales,
      purchases: totalPurchases,
      profit: totalSales - totalPurchases
    },
    counterpartyTotals,
    itemSold
  });
}
