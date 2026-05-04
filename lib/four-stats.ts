import { getSupabaseAdmin } from '@/lib/supabase';

type TxRow = {
  id: number;
  session_id: number | null;
  counterparty: string | null;
  created_at: string;
  created_by: string | null;
  status: string | null;
  total_purchases: number;
  total_sales: number;
  profit_loss: number;
  four_transaction_lines: Array<{ item_id: number; item_name: string; movement_kind: 'buy' | 'sell'; quantity: number; unit_price: number; total_amount: number }>;
};

type MovementRow = {
  session_id: number;
  item_id: number | null;
  item_name: string | null;
  movement_kind: 'buy' | 'sell' | 'stock_in' | 'stock_out' | string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  created_at: string;
};

export type FourStatsPayload = {
  totals: { purchases: number; sales: number; profit: number; transactions: number };
  byClient: Array<{ key: string; count: number; purchases: number; sales: number; profit: number; ratio: number }>;
  byMember: Array<{ key: string; count: number; purchases: number; sales: number; profit: number }>;
  byItem: Array<{ itemId: number; itemName: string; imageUrl: string | null; buyQty: number; sellQty: number; buyAmount: number; sellAmount: number; frequency: number }>;
  history: Array<{ id: number; createdAt: string; counterparty: string | null; creatorLabel: string; totals: { purchases: number; sales: number; profit: number }; lines: Array<{ itemId: number; itemName: string; imageUrl: string | null; movementKind: 'buy' | 'sell'; quantity: number; unitPrice: number; totalAmount: number }> }>;
};

export async function buildFourStats(): Promise<FourStatsPayload> {
  const supabase = getSupabaseAdmin();
  const [{ data: txRows }, { data: movementRows }] = await Promise.all([
    supabase
      .from('four_transactions')
      .select('id, session_id, counterparty, created_at, created_by, status, total_purchases, total_sales, profit_loss, four_transaction_lines(item_id, item_name, movement_kind, quantity, unit_price, total_amount)')
      .or('status.eq.validated,status.is.null')
      .order('created_at', { ascending: false })
      .limit(1200),
    supabase
      .from('four_movements')
      .select('session_id, item_id, item_name, movement_kind, quantity, unit_price, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(4000)
  ]);

  const movementsBySession = new Map<number, MovementRow[]>();
  for (const movement of (movementRows ?? []) as MovementRow[]) {
    if (!movement.session_id) continue;
    const bucket = movementsBySession.get(movement.session_id) ?? [];
    bucket.push(movement);
    movementsBySession.set(movement.session_id, bucket);
  }

  const transactions = ((txRows ?? []) as TxRow[]).map((tx) => {
    const txLines = tx.four_transaction_lines ?? [];
    if (txLines.length > 0) return tx;

    const fallback = (tx.session_id ? movementsBySession.get(tx.session_id) : []) ?? [];
    const transformed = fallback
      .filter((line) => line.movement_kind === 'buy' || line.movement_kind === 'sell')
      .map((line) => ({
        item_id: Number(line.item_id ?? 0),
        item_name: line.item_name || 'Item',
        movement_kind: line.movement_kind as 'buy' | 'sell',
        quantity: Number(line.quantity ?? 0),
        unit_price: Number(line.unit_price ?? 0),
        total_amount: Number(line.total_amount ?? 0),
      }));

    return { ...tx, four_transaction_lines: transformed };
  });

  const creatorIds = Array.from(new Set(transactions.map((tx) => tx.created_by).filter((id): id is string => Boolean(id))));
  const itemIdsFromLines = Array.from(new Set(
    transactions.flatMap((tx) => (tx.four_transaction_lines ?? []).map((line) => Number(line.item_id ?? 0))).filter((itemId) => itemId > 0)
  ));
  const itemIdsFromMovements = Array.from(new Set(
    ((movementRows ?? []) as MovementRow[]).map((movement) => Number(movement.item_id ?? 0)).filter((itemId) => itemId > 0)
  ));
  const itemIds = Array.from(new Set([...itemIdsFromLines, ...itemIdsFromMovements]));

  const [{ data: creators }, { data: items }] = await Promise.all([
    creatorIds.length > 0 ? supabase.from('users').select('id, name, username').eq('is_active', true).in('id', creatorIds) : Promise.resolve({ data: [] }),
    itemIds.length > 0 ? supabase.from('items').select('id, image_url').in('id', itemIds) : Promise.resolve({ data: [] })
  ]);

  const creatorById = new Map(((creators ?? []) as Array<{ id: string; name: string | null; username: string | null }>).map((entry) => [entry.id, entry]));
  const itemImageById = new Map(((items ?? []) as Array<{ id: number; image_url: string | null }>).map((entry) => [Number(entry.id), entry.image_url ?? null]));
  const statsTransactions = transactions.filter((tx) => tx.created_by && creatorById.has(tx.created_by));

  const totals = statsTransactions.reduce((acc, row) => ({
    purchases: acc.purchases + Number(row.total_purchases ?? 0),
    sales: acc.sales + Number(row.total_sales ?? 0),
    profit: acc.profit + Number(row.profit_loss ?? 0),
    transactions: acc.transactions + 1
  }), { purchases: 0, sales: 0, profit: 0, transactions: 0 });

  const byClientMap = new Map<string, { key: string; count: number; purchases: number; sales: number; profit: number; ratio: number }>();
  const byMemberMap = new Map<string, { key: string; count: number; purchases: number; sales: number; profit: number }>();
  const byItemMap = new Map<number, { itemId: number; itemName: string; imageUrl: string | null; buyQty: number; sellQty: number; buyAmount: number; sellAmount: number; frequency: number }>();

  for (const tx of statsTransactions) {
    const clientKey = tx.counterparty?.trim() || 'Sans interlocuteur';
    const memberPayload = tx.created_by ? creatorById.get(tx.created_by) : null;
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
      const itemId = Number(line.item_id ?? 0);
      if (!itemId) continue;
      const current = byItemMap.get(itemId) ?? { itemId, itemName: line.item_name, imageUrl: itemImageById.get(itemId) ?? null, buyQty: 0, sellQty: 0, buyAmount: 0, sellAmount: 0, frequency: 0 };
      current.frequency += 1;
      if (line.movement_kind === 'buy') {
        current.buyQty += Number(line.quantity ?? 0);
        current.buyAmount += Number(line.total_amount ?? 0);
      } else {
        current.sellQty += Number(line.quantity ?? 0);
        current.sellAmount += Number(line.total_amount ?? 0);
      }
      byItemMap.set(itemId, current);
    }
  }

  const byClient = Array.from(byClientMap.values()).sort((a, b) => b.count - a.count || b.sales - a.sales).slice(0, 40);
  const byMember = Array.from(byMemberMap.values()).sort((a, b) => b.count - a.count || b.sales - a.sales).slice(0, 40);
  const byItem = Array.from(byItemMap.values()).sort((a, b) => b.frequency - a.frequency).slice(0, 80);

  const history = transactions.map((tx) => {
    const memberPayload = tx.created_by ? creatorById.get(tx.created_by) : null;
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
        const itemId = Number(line.item_id ?? 0);
        return {
          itemId,
          itemName: line.item_name,
          imageUrl: itemImageById.get(itemId) ?? null,
          movementKind: line.movement_kind,
          quantity: Number(line.quantity ?? 0),
          unitPrice: Number(line.unit_price ?? 0),
          totalAmount: Number(line.total_amount ?? 0)
        };
      })
    };
  });

  return { totals, byClient, byMember, byItem, history };
}
