import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logTabletWebhookFailure, testTabletWebhook } from '@/lib/tablet-discord-webhook';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canEdit] = await Promise.all([
    hasUserPermission(session.userId, 'logs.access'),
    hasUserPermission(session.userId, 'logs.webhooks.tablet.edit')
  ]);
  if (!canAccess || !canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  try {
    const result = await testTabletWebhook(supabase);
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });

    await createAuditLog({
      actorUserId: session.userId,
      action: 'logs.webhooks.tablet.test',
      entityType: 'tablet_discord_webhook',
      summary: 'Webhook Discord Tablette testé.',
      newValues: { configured: true }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logTabletWebhookFailure(supabase, session.userId, 'logs_test', error);
    return NextResponse.json({ message: 'Test webhook tablette impossible.' }, { status: 502 });
  }
}
