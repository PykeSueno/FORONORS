import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourTabs } from '@/components/four/four-tabs';
import { FourStatsClient } from '@/components/four/four-stats-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type TxRow = {
  id: number;
  counterparty: string | null;
  created_at: string;
  total_purchases: number;
  total_sales: number;
  profit_loss: number;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
  four_transaction_lines: Array<{ item_id: number; item_name: string; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number; total_amount: number; items?: { image_url: string | null } | { image_url: string | null }[] | null }>;
};

export default async function FourStatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access') || !permissions.includes('four.stats.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('four_transactions')
    .select('id, counterparty, created_at, total_purchases, total_sales, profit_loss, users(name, username), four_transaction_lines(item_id, item_name, movement_kind, quantity, unit_price, total_amount, items(image_url))')
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(500);

  const transactions = (data ?? []) as TxRow[];
  const totals = transactions.reduce((acc, row) => ({
    purchases: acc.purchases + Number(row.total_purchases ?? 0),
    sales: acc.sales + Number(row.total_sales ?? 0),
    profit: acc.profit + Number(row.profit_loss ?? 0),
    transactions: acc.transactions + 1
  }), { purchases: 0, sales: 0, profit: 0, transactions: 0 });

  const byClientMap = new Map<string, { key: string; count: number; purchases: number; sales: number; profit: number; ratio: number }>();
  const byMemberMap = new Map<string, { key: string; count: number; purchases: number; sales: number; profit: number }>();
  const byItemMap = new Map<number, { itemId: number; itemName: string; imageUrl: string | null; buyQty: number; sellQty: number; buyAmount: number; sellAmount: number; frequency: number }>();

  for (const tx of transactions) {
    const clientKey = tx.counterparty?.trim() || 'Sans interlocuteur';
    const memberPayload = Array.isArray(tx.users) ? tx.users[0] : tx.users;
    const memberKey = memberPayload?.name || memberPayload?.username || 'Inconnu';

    const byClient = byClientMap.get(clientKey) ?? { key: clientKey, count: 0, purchases: 0, sales: 0, profit: 0, ratio: 0 };
    byClient.count += 1;
    byClient.purchases += Number(tx.total_purchases ?? 0);
    byClient.sales += Number(tx.total_sales ?? 0);
    byClient.profit += Number(tx.profit_loss ?? 0);
    byClient.ratio = byClient.sales > 0 ? byClient.purchases / byClient.sales : 0;
    byClientMap.set(clientKey, byClient);

    const byMember = byMemberMap.get(memberKey) ?? { key: memberKey, count: 0, purchases: 0, sales: 0, profit: 0 };
    byMember.count += 1;
    byMember.purchases += Number(tx.total_purchases ?? 0);
    byMember.sales += Number(tx.total_sales ?? 0);
    byMember.profit += Number(tx.profit_loss ?? 0);
    byMemberMap.set(memberKey, byMember);

    for (const line of tx.four_transaction_lines ?? []) {
      const itemPayload = Array.isArray(line.items) ? line.items[0] : line.items;
      const current = byItemMap.get(line.item_id) ?? { itemId: line.item_id, itemName: line.item_name, imageUrl: itemPayload?.image_url ?? null, buyQty: 0, sellQty: 0, buyAmount: 0, sellAmount: 0, frequency: 0 };
      current.frequency += 1;
      if (line.movement_kind === 'buy') {
        current.buyQty += Number(line.quantity ?? 0);
        current.buyAmount += Number(line.total_amount ?? 0);
      } else {
        current.sellQty += Number(line.quantity ?? 0);
        current.sellAmount += Number(line.total_amount ?? 0);
      }
      byItemMap.set(line.item_id, current);
    }
  }

  const byClient = Array.from(byClientMap.values()).sort((a, b) => b.count - a.count || b.sales - a.sales).slice(0, 30);
  const byMember = Array.from(byMemberMap.values()).sort((a, b) => b.count - a.count || b.sales - a.sales).slice(0, 30);
  const byItem = Array.from(byItemMap.values()).sort((a, b) => b.frequency - a.frequency).slice(0, 60);

  const history = transactions.map((tx) => {
    const memberPayload = Array.isArray(tx.users) ? tx.users[0] : tx.users;
    return {
      id: tx.id,
      createdAt: tx.created_at,
      counterparty: tx.counterparty,
      creatorLabel: memberPayload?.name || memberPayload?.username || 'Inconnu',
      totals: {
        purchases: Number(tx.total_purchases ?? 0),
        sales: Number(tx.total_sales ?? 0),
        profit: Number(tx.profit_loss ?? 0)
      },
      lines: (tx.four_transaction_lines ?? []).map((line) => {
        const itemPayload = Array.isArray(line.items) ? line.items[0] : line.items;
        return {
          itemId: line.item_id,
          itemName: line.item_name,
          imageUrl: itemPayload?.image_url ?? null,
          movementKind: line.movement_kind,
          quantity: Number(line.quantity ?? 0),
          unitPrice: Number(line.unit_price ?? 0),
          totalAmount: Number(line.total_amount ?? 0)
        };
      })
    };
  });

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Stats FOUR" subtitle="Vue globale, clients, membres, items et historique détaillé" />
      <FourTabs active="stats" canSeeStats canSeeMessages={permissions.includes('four.messages.view')} />
      <FourStatsClient totals={totals} byClient={byClient} byMember={byMember} byItem={byItem} history={history} />
    </div>
  );
}
