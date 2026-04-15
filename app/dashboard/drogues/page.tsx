import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { DrugsPageClient } from '@/components/drugs/drugs-page-client';

export default async function DrugsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('drugs.access')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: transfos }, { data: sales }, { data: members }, { data: items }] = await Promise.all([
    supabase.from('drug_transfos').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('drug_sales').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('items').select('id, name, image_url, quantity').order('name', { ascending: true })
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Drogues" subtitle="Transfo et ventes drogue avec suivi stock/argent" />
      <DrugsPageClient
        transfos={transfos ?? []}
        sales={sales ?? []}
        members={members ?? []}
        items={items ?? []}
        canTransfoCreate={permissions.includes('drugs.transfo.create')}
        canTransfoValidate={permissions.includes('drugs.transfo.validate')}
        canTransfoCancelOwn={permissions.includes('drugs.transfo.cancel.own')}
        canTransfoCancelAny={permissions.includes('drugs.transfo.cancel.any')}
        canSalesCreate={permissions.includes('drugs.sales.create')}
      />
    </div>
  );
}
