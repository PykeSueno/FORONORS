import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { StockMovementsPageClient } from '@/components/dashboard/stock-movements-page-client';
import { stockMovementSource } from '@/lib/labels';

type StockMovementRow = {
  id: number;
  item_id: number | null;
  transaction_id: number | null;
  item_name: string;
  quantity_delta: number;
  transaction_type: string;
  created_at: string;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
  items: { image_url: string | null; category_label: string | null; quantity: number | null } | { image_url: string | null; category_label: string | null; quantity: number | null }[] | null;
};

export default async function StockMovementsGlobalPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('items.movements.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from('item_stock_movements')
    .select('id, item_id, transaction_id, item_name, quantity_delta, transaction_type, created_at, users(name, username), items(image_url, category_label, quantity)')
    .order('created_at', { ascending: false })
    .limit(700);

  const runningAfterByItem = new Map<number, number>();
  const prepared = ((rows ?? []) as StockMovementRow[]).map((row) => {
    const itemPayload = Array.isArray(row.items) ? row.items[0] : row.items;
    const itemId = Number(row.item_id ?? 0);
    let before: number | null = null;
    let after: number | null = null;
    if (itemId > 0) {
      const knownAfter = runningAfterByItem.has(itemId) ? runningAfterByItem.get(itemId) : Number(itemPayload?.quantity ?? NaN);
      if (Number.isFinite(knownAfter)) {
        after = Number(knownAfter);
        before = after - Number(row.quantity_delta ?? 0);
        runningAfterByItem.set(itemId, before);
      }
    }

    return {
      id: row.id,
      item_id: row.item_id,
      transaction_id: row.transaction_id,
      item: row.item_name,
      quantity: Number(row.quantity_delta ?? 0),
      type: row.transaction_type,
      created_at: row.created_at,
      user_name: (Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe',
      image: itemPayload?.image_url ?? null,
      category: itemPayload?.category_label ?? null,
      source: stockMovementSource(row.transaction_type),
      before,
      after
    };
  });

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Mouvements stock globaux" subtitle="Historique complet des entrées / sorties stock" />
      <StockMovementsPageClient rows={prepared} />
    </div>
  );
}
