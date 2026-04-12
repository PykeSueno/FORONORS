import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ItemsPageClient } from '@/components/items/items-page-client';
import { ITEM_CATEGORIES } from '@/lib/items';

export default async function ItemsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userPermissions = await getUserPermissions(session.userId);
  if (!userPermissions.includes('items.access')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data: items } = await supabase
    .from('items')
    .select('id, name, image_url, buy_price, sell_price, quantity, weapon_identifier, is_money_item, category_key, category_label, type_key, type_label, created_at, updated_at')
    .order('name', { ascending: true });

  return (
    <>
      <InternalPageHeader title="Items" subtitle="Catalogue interne et gestion des stocks" />
      <ItemsPageClient
      initialItems={items ?? []}
      categories={ITEM_CATEGORIES}
      canCreate={userPermissions.includes('items.create')}
      canEdit={userPermissions.includes('items.edit')}
      canDelete={userPermissions.includes('items.delete')}
    />
    </>
  );
}
