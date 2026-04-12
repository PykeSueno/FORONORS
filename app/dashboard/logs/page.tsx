import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LogsPageClient } from '@/components/logs/logs-page-client';

export default async function LogsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const canAccess = permissions.includes('logs.access');
  const canView = permissions.includes('logs.view');
  const canManageWebhook = permissions.includes('logs.webhook.manage');

  if (!canAccess || !canView) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: logs }, { data: webhook }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, actor_name, actor_username, actor_role, action, entity_type, entity_id, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('app_settings').select('value').eq('key', 'discord.log_webhook_url').maybeSingle()
  ]);

  return (
    <LogsPageClient
      initialLogs={logs ?? []}
      initialWebhookUrl={webhook?.value ?? ''}
      canManageWebhook={canManageWebhook}
    />
  );
}
