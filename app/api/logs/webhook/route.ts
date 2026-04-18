import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

const KEY = 'discord.log_webhook_url';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'logs.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();

  return NextResponse.json({ webhookUrl: data?.value ?? '' });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canManage] = await Promise.all([
    hasUserPermission(session.userId, 'logs.access'),
    hasUserPermission(session.userId, 'logs.webhook.manage')
  ]);
  if (!canAccess || !canManage) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { webhookUrl?: string };
  const normalized = body.webhookUrl?.trim() ?? '';

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: normalized }, { onConflict: 'key' });

  if (error) return NextResponse.json({ message: 'Mise à jour webhook impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'logs.webhook.manage',
    entityType: 'settings',
    entityId: KEY,
    summary: normalized ? 'Webhook Discord logs configuré' : 'Webhook Discord logs supprimé',
    newValues: { configured: Boolean(normalized) }
  });

  return NextResponse.json({ ok: true });
}
