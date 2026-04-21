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
  const { data: transactions } = await supabase
    .from('four_transactions')
    .select('id, counterparty, status, created_by, total_purchases, total_sales, profit_loss, created_at')
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(600);

  const totals = (transactions ?? []).reduce((acc, row) => ({
    purchases: acc.purchases + Number(row.total_purchases ?? 0),
    sales: acc.sales + Number(row.total_sales ?? 0),
    profit: acc.profit + Number(row.profit_loss ?? 0),
    transactions: acc.transactions + 1
  }), { purchases: 0, sales: 0, profit: 0, transactions: 0 });

  return NextResponse.json({ totals, transactions: transactions ?? [] });
}
