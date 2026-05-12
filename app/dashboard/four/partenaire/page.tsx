import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourPartnerClient, type FourPartnerSale } from '@/components/four/four-partner-client';
import { FourTabs } from '@/components/four/four-tabs';
import { getSession } from '@/lib/auth';
import { DEFAULT_FOUR_PARTNER_CONFIG } from '@/lib/four-partner';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function FourPartnerPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access') || !permissions.includes('four.partner.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: configRow }, { data: items }, { data: sales }] = await Promise.all([
    supabase.from('four_partner_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('items').select('id, name, image_url, quantity, buy_price, category_key, type_key').order('name', { ascending: true }),
    supabase.from('four_partner_sales').select('*').order('created_at', { ascending: false }).limit(200)
  ]);

  const config = configRow ?? { id: 1, ...DEFAULT_FOUR_PARTNER_CONFIG };

  return (
    <div className="space-y-5">
      <InternalPageHeader title="FOUR Partenaire" subtitle="Cycle partenaire, ventes, objets rapportés et suivi bank" />
      <FourTabs
        active="partner"
        canSeeHistory={permissions.includes('four.history.view')}
        canSeeStats={permissions.includes('four.stats.view')}
        canSeeMessages={permissions.includes('four.messages.view')}
        canSeePartner
      />
      <FourPartnerClient
        config={config}
        items={items ?? []}
        sales={(sales ?? []) as FourPartnerSale[]}
        canConfig={permissions.includes('four.partner.config')}
        canSell={permissions.includes('four.partner.sell')}
        canHistory={permissions.includes('four.partner.history.view')}
        canStats={permissions.includes('four.partner.stats.view')}
      />
    </div>
  );
}
