import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletWebhookStatus, saveTabletWebhookUrl, TABLET_WEBHOOK_KEY } from '@/lib/tablet-discord-webhook';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canView = await hasUserPermission(session.userId, 'jobs.tablet.webhook.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const status = await getTabletWebhookStatus(getSupabaseAdmin());
  return NextResponse.json(status);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canView, canEdit] = await Promise.all([
    hasUserPermission(session.userId, 'jobs.tablet.webhook.view'),
    hasUserPermission(session.userId, 'jobs.tablet.webhook.edit')
  ]);
  if (!canView || !canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { webhookUrl?: string };
  const supabase = getSupabaseAdmin();
  const result = await saveTabletWebhookUrl(supabase, body.webhookUrl ?? '');

  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'tablet.discord_webhook.configured',
    entityType: 'settings',
    entityId: TABLET_WEBHOOK_KEY,
    summary: result.configured ? 'Webhook Tablette Discord configuré.' : 'Webhook Tablette Discord supprimé.',
    newValues: { configured: result.configured }
  });

  return NextResponse.json({ ok: true, configured: result.configured });
}
