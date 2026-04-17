import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { StockMovementsPageClient } from '@/components/dashboard/stock-movements-page-client';
import { stockMovementSource } from '@/lib/labels';

type StockMovementRow = {
  id: number;
  item_name: string;
  quantity_delta: number;
  transaction_type: string;
  created_at: string;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
  items: { image_url: string | null; category_label: string | null } | { image_url: string | null; category_label: string | null }[] | null;
};

export default async function StockMovementsGlobalPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('items.movements.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from('item_stock_movements')
    .select('id, item_name, quantity_delta, transaction_type, created_at, users(name, username), items(image_url, category_label)')
    .order('created_at', { ascending: false })
    .limit(700);

  const prepared = ((rows ?? []) as StockMovementRow[]).map((row) => ({
    id: row.id,
    item: row.item_name,
    quantity: Number(row.quantity_delta ?? 0),
    type: row.transaction_type,
    created_at: row.created_at,
    user_name: (Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe',
    image: Array.isArray(row.items) ? row.items[0]?.image_url ?? null : row.items?.image_url ?? null,
    category: Array.isArray(row.items) ? row.items[0]?.category_label ?? null : row.items?.category_label ?? null,
    source: stockMovementSource(row.transaction_type)
  }));

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Mouvements stock globaux" subtitle="Historique complet des entrées / sorties stock" />
      <StockMovementsPageClient rows={prepared} />
    </div>
  );
}
