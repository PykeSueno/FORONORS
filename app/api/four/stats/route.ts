import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type ManagedUser = { name: string | null; username: string | null };
type SessionTransaction = { counterparty: string | null; total_purchases: number | null; total_sales: number | null; profit_loss: number | null };
type FourStatsSession = {
  id: number;
  opened_at: string;
  closed_at: string | null;
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
    .select('id, opened_at, closed_at, managed_by, users:managed_by(name, username), summary, four_transactions(id, counterparty, total_purchases, total_sales, profit_loss)')
    .order('opened_at', { ascending: false })
    .limit(100);

  const byCounterparty: Record<string, { purchases: number; sales: number; count: number }> = {};
  const byMember: Record<string, { sessions: number; profit: number }> = {};
  let totalPurchases = 0;
  let totalSales = 0;
  const sessionRows = (sessions ?? []) as FourStatsSession[];

  for (const fourSession of sessionRows) {
    const managedUser = Array.isArray(fourSession.users) ? fourSession.users[0] : fourSession.users;
    const memberName = managedUser?.name || managedUser?.username || 'Inconnu';
    if (!byMember[memberName]) byMember[memberName] = { sessions: 0, profit: 0 };
    byMember[memberName].sessions += 1;

    for (const tx of fourSession.four_transactions ?? []) {
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
    }
  }

  return NextResponse.json({
    totals: {
      sessions: sessionRows.length,
      purchases: totalPurchases,
      sales: totalSales,
      profit: totalSales - totalPurchases
    },
    byMember,
    byCounterparty,
    sessions: sessionRows
  });
}
