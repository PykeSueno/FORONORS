import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { FourTabs } from '@/components/four/four-tabs';
import { FourMessagesClient } from '@/components/four/four-messages-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function FourMessagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('four.access') || !permissions.includes('four.messages.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const { data: messages } = await supabase.from('four_messages').select('id, title, content, display_order').order('display_order', { ascending: true }).order('id', { ascending: true });

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Messages FOUR" subtitle="Messages prédéfinis avec copie, modification et suppression" />
      <FourTabs active="messages" canSeeHistory={permissions.includes('four.history.view')} canSeeStats={permissions.includes('four.stats.view')} canSeeMessages canSeePartner={permissions.includes('four.partner.view')} />
      <FourMessagesClient initialMessages={messages ?? []} canManage={permissions.includes('four.messages.manage')} />
    </div>
  );
}
