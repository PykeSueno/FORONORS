import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { SaleObjectsPageClient } from '@/components/sale-objects/sale-objects-page-client';

type SaleObjectPageItem = { id: number; name: string; image_url: string | null; quantity: number; sell_price: number; category_label: string | null; category_key?: string | null };
type SaleObjectHistoryRow = {
  id: number;
  buyer_name: string;
  buyer_type: 'pawnshop_sud' | 'pawnshop_nord' | 'group';
  status: 'paid' | 'pending_receipt' | 'canceled';
  total_amount: number;
  sale_lines: Array<{ itemId: number; itemName: string; itemImageUrl?: string | null; quantity: number; unitPrice: number; lineTotal: number; stockBefore: number; stockAfter: number }>;
  cash_before: number | null;
  cash_after: number | null;
  created_by: string | null;
  received_by: string | null;
  canceled_by: string | null;
  received_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

export default async function SaleObjectsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('sale.objects.access');
  if (!canAccess) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: sellableItems }, { data: sales }] = await Promise.all([
    supabase.from('items').select('id, name, image_url, quantity, sell_price, category_label, category_key').eq('category_key', 'objects').gt('quantity', 0).order('name', { ascending: true }).limit(400),
    permissions.includes('sale.objects.history.view')
      ? supabase.from('sale_object_orders').select('id, buyer_name, buyer_type, status, total_amount, sale_lines, cash_before, cash_after, created_by, received_by, canceled_by, received_at, canceled_at, created_at, updated_at, creator:created_by(name, username), receiver:received_by(name, username), canceler:canceled_by(name, username)').order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] })
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Vente objets" subtitle="Vendre les objets du groupe avec suivi de réception pawnshop" />
      <SaleObjectsPageClient
        items={(sellableItems ?? []) as SaleObjectPageItem[]}
        initialSales={(sales ?? []) as SaleObjectHistoryRow[]}
        canCreate={permissions.includes('sale.objects.create')}
        canReceive={permissions.includes('sale.objects.receive')}
        canEditOwn={permissions.includes('sale.objects.edit.own')}
        canEditAny={permissions.includes('sale.objects.edit.any')}
        canCancelOwn={permissions.includes('sale.objects.cancel.own')}
        canCancelAny={permissions.includes('sale.objects.cancel.any')}
        canHistoryView={permissions.includes('sale.objects.history.view')}
        currentUserId={session.userId}
      />
    </div>
  );
}
