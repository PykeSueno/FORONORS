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
  const [{ data: transfos }, { data: sales }, { data: productions }, { data: members }, { data: items }] = await Promise.all([
    supabase.from('drug_transfos').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('drug_sales').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('drug_productions').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('items').select('id, name, image_url, quantity').order('name', { ascending: true })
  ]);

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Drogues" subtitle="Transfo, vente et production — suivi stock / argent / membres" />
      <DrugsPageClient
        currentUserId={session.userId}
        transfos={transfos ?? []}
        sales={sales ?? []}
        productions={productions ?? []}
        members={members ?? []}
        items={items ?? []}
        canTransfoView={permissions.includes('drugs.transfo.view')}
        canTransfoCreate={permissions.includes('drugs.transfo.create')}
        canTransfoReceiveValidate={permissions.includes('drugs.transfo.receive.validate')}
        canTransfoCancelOwn={permissions.includes('drugs.transfo.cancel.own')}
        canTransfoCancelAny={permissions.includes('drugs.transfo.cancel.any')}
        canTransfoEditOwn={permissions.includes('drugs.transfo.edit.own')}
        canTransfoEditAny={permissions.includes('drugs.transfo.edit.any')}
        canSalesView={permissions.includes('drugs.sales.view')}
        canSalesCreate={permissions.includes('drugs.sales.create')}
        canProductionAccess={permissions.includes('drugs.production.access')}
        canProductionCreate={permissions.includes('drugs.production.create')}
        canProductionCokeCreate={permissions.includes('drugs.production.coke.create')}
        canProductionMethCreate={permissions.includes('drugs.production.meth.create')}
        canProductionHistoryView={permissions.includes('drugs.production.history.view') || permissions.includes('drugs.production.access')}
      />
    </div>
  );
}
