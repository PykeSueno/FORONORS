import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletWebhookStatus, saveTabletWebhookUrl, TABLET_WEBHOOK_KEY } from '@/lib/tablet-discord-webhook';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canView] = await Promise.all([
    hasUserPermission(session.userId, 'logs.access'),
    hasUserPermission(session.userId, 'logs.webhooks.tablet.view')
  ]);
  if (!canAccess || !canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  return NextResponse.json(await getTabletWebhookStatus(getSupabaseAdmin()));
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canEdit] = await Promise.all([
    hasUserPermission(session.userId, 'logs.access'),
    hasUserPermission(session.userId, 'logs.webhooks.tablet.edit')
  ]);
  if (!canAccess || !canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { webhookUrl?: string };
  const supabase = getSupabaseAdmin();
  const result = await saveTabletWebhookUrl(supabase, body.webhookUrl ?? '');

  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'logs.webhooks.tablet.edit',
    entityType: 'settings',
    entityId: TABLET_WEBHOOK_KEY,
    summary: result.configured ? 'Webhook Discord Tablette configuré.' : 'Webhook Discord Tablette supprimé.',
    newValues: { configured: result.configured }
  });

  return NextResponse.json({ ok: true, configured: result.configured });
}
