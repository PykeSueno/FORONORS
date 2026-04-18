import { getSupabaseAdmin } from './supabase';

type CreateAuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

async function getDiscordWebhookUrl() {
  const envWebhook = process.env.DISCORD_LOG_WEBHOOK_URL;
  if (envWebhook) return envWebhook;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'discord.log_webhook_url').maybeSingle();
  return data?.value as string | undefined;
}

async function sendDiscordWebhook(payload: {
  actorName: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
  createdAt: string;
}) {
  const webhookUrl = await getDiscordWebhookUrl();
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'FORONORS Logs',
      embeds: [
        {
          title: `🔔 ${payload.action}`,
          color: 13224393,
          description: payload.summary,
          fields: [
            { name: 'Membre', value: `${payload.actorName} (@${payload.actorUsername})`, inline: true },
            { name: 'Rôle', value: payload.actorRole || 'N/A', inline: true },
            { name: 'Élément', value: `${payload.entityType}${payload.entityId ? ` #${payload.entityId}` : ''}`, inline: false }
          ],
          timestamp: payload.createdAt
        }
      ]
    })
  });
}

export async function createAuditLog(input: CreateAuditLogInput) {
  const supabase = getSupabaseAdmin();
  const { data: actor } = await supabase
    .from('users')
    .select('id, username, name, role')
    .eq('id', input.actorUserId)
    .maybeSingle();

  const createdAt = new Date().toISOString();
  const { data } = await supabase
    .from('audit_logs')
    .insert({
      actor_user_id: input.actorUserId,
      actor_name: actor?.name ?? actor?.username ?? 'Inconnu',
      actor_username: actor?.username ?? 'unknown',
      actor_role: actor?.role ?? '',
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ? String(input.entityId) : null,
      summary: input.summary,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      metadata: input.metadata ?? null,
      created_at: createdAt
    })
    .select('id')
    .maybeSingle();

  try {
    await sendDiscordWebhook({
      actorName: actor?.name ?? actor?.username ?? 'Inconnu',
      actorUsername: actor?.username ?? 'unknown',
      actorRole: actor?.role ?? '',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      createdAt
    });
  } catch (error) {
    console.error('Discord webhook log failed', error);
  }

  return data?.id;
}
