import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuditLog } from './audit-log';
import { formatParisDate, formatParisDateTime, getTabletBusinessDate } from './tablet';

export const TABLET_WEBHOOK_KEY = 'discord.tablet_webhook_url';
const TABLET_PASSAGE_SENT_PREFIX = 'tablet_passage_discord_sent';
const TABLET_DAILY_REPORT_SENT_PREFIX = 'tablet_daily_report_sent';
const SYSTEM_ACTOR_KEY = 'system.cron_actor_user_id';

type PassageDiscordPayload = {
  id: number;
  member_label: string;
  before_cash: number;
  after_cash: number;
  before_kits: number;
  after_kits: number;
  before_cutters: number;
  after_cutters: number;
  created_at: string;
};

type ActiveMember = { id: string; name: string; username: string };

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatList(names: string[]) {
  return names.length > 0 ? names.map((name) => `- ${name}`).join('\n') : '- Aucun';
}

function markerKey(prefix: string, id: string | number) {
  return `${prefix}:${id}`;
}

function sanitizeWebhookUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const allowedHost = url.hostname === 'discord.com' || url.hostname.endsWith('.discord.com') || url.hostname === 'discordapp.com' || url.hostname.endsWith('.discordapp.com');
    if (url.protocol !== 'https:' || !allowedHost) return '';
    if (!url.pathname.startsWith('/api/webhooks/')) return '';
    return trimmed;
  } catch {
    return '';
  }
}

async function getSetting(supabase: SupabaseClient, key: string) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  return typeof data?.value === 'string' ? data.value : '';
}

async function setSetting(supabase: SupabaseClient, key: string, value: string) {
  await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

async function getTabletWebhookUrl(supabase: SupabaseClient) {
  return sanitizeWebhookUrl(await getSetting(supabase, TABLET_WEBHOOK_KEY));
}

async function postToDiscord(webhookUrl: string, content: string) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'FORONORS Tablette',
      content,
      allowed_mentions: { parse: [] }
    })
  });

  if (!response.ok) throw new Error(`Discord webhook HTTP ${response.status}`);
}

export async function getTabletWebhookStatus(supabase: SupabaseClient) {
  const webhookUrl = await getTabletWebhookUrl(supabase);
  return { configured: Boolean(webhookUrl) };
}

export async function saveTabletWebhookUrl(supabase: SupabaseClient, rawUrl: string) {
  const normalized = rawUrl.trim() ? sanitizeWebhookUrl(rawUrl) : '';
  if (rawUrl.trim() && !normalized) return { ok: false, message: 'URL webhook Discord invalide.' };
  await setSetting(supabase, TABLET_WEBHOOK_KEY, normalized);
  return { ok: true, configured: Boolean(normalized) };
}

export async function testTabletWebhook(supabase: SupabaseClient) {
  const webhookUrl = await getTabletWebhookUrl(supabase);
  if (!webhookUrl) return { ok: false, message: 'Webhook tablette non configuré.' };

  await postToDiscord(webhookUrl, '✅ Test webhook tablette FORONORS');
  return { ok: true };
}

export async function logTabletWebhookFailure(supabase: SupabaseClient, actorUserId: string, context: string, error: unknown) {
  await createAuditLog({
    actorUserId,
    action: 'discord_webhook_failed',
    entityType: 'tablet_discord_webhook',
    entityId: context,
    summary: `Échec webhook Discord tablette (${context}).`,
    metadata: { context, error: error instanceof Error ? error.message : 'unknown_error' }
  });
}

export async function sendTabletPassageDiscord(supabase: SupabaseClient, actorUserId: string, passage: PassageDiscordPayload) {
  const webhookUrl = await getTabletWebhookUrl(supabase);
  if (!webhookUrl) return { skipped: true, reason: 'not_configured' };

  const sentKey = markerKey(TABLET_PASSAGE_SENT_PREFIX, passage.id);
  if (await getSetting(supabase, sentKey)) return { skipped: true, reason: 'already_sent' };

  const content = [
    '📱 Passage tablette validé',
    '',
    `👤 Membre : ${passage.member_label}`,
    `💸 Dépôt avant/après : ${formatMoney(Number(passage.before_cash))} → ${formatMoney(Number(passage.after_cash))}`,
    `🎒 Kits : ${passage.before_kits} → ${passage.after_kits}`,
    `🛠️ Disqueuses : ${passage.before_cutters} → ${passage.after_cutters}`,
    `🕒 Date : ${formatParisDateTime(passage.created_at)}`
  ].join('\n');

  try {
    await postToDiscord(webhookUrl, content);
    await setSetting(supabase, sentKey, new Date().toISOString());
    await createAuditLog({
      actorUserId,
      action: 'tablet.discord_webhook.passage_sent',
      entityType: 'tablet_passage',
      entityId: passage.id,
      summary: `Message Discord passage tablette envoyé pour ${passage.member_label}.`,
      newValues: { passageId: passage.id, memberLabel: passage.member_label }
    });
    return { sent: true };
  } catch (error) {
    await logTabletWebhookFailure(supabase, actorUserId, `passage:${passage.id}`, error);
    return { sent: false, error };
  }
}

export async function sendTabletDailyReport(supabase: SupabaseClient, actorUserId: string, reportDate = getTabletBusinessDate()) {
  const webhookUrl = await getTabletWebhookUrl(supabase);
  if (!webhookUrl) return { skipped: true, reason: 'not_configured', reportDate };

  const sentKey = markerKey(TABLET_DAILY_REPORT_SENT_PREFIX, reportDate);
  if (await getSetting(supabase, sentKey)) return { skipped: true, reason: 'already_sent', reportDate };

  const [{ data: activeMembers }, { data: day }] = await Promise.all([
    supabase.from('users').select('id, name, username').eq('is_active', true).order('username', { ascending: true }),
    supabase.from('tablet_days').select('id').eq('business_day', reportDate).maybeSingle()
  ]);

  const members = (activeMembers ?? []) as ActiveMember[];
  const { data: passages } = day?.id
    ? await supabase.from('tablet_passages').select('member_user_id, member_label').eq('tablet_day_id', day.id)
    : { data: [] };

  const doneIds = new Set((passages ?? []).map((passage) => passage.member_user_id).filter(Boolean) as string[]);
  const doneNames = members.filter((member) => doneIds.has(member.id)).map((member) => member.name || member.username);
  const missingNames = members.filter((member) => !doneIds.has(member.id)).map((member) => member.name || member.username);

  const content = [
    '📋 Récap tablette du jour',
    '',
    '✅ Ont fait leur tablette :',
    formatList(doneNames),
    '',
    '❌ N’ont pas fait leur tablette :',
    formatList(missingNames),
    '',
    `📅 Date : ${formatParisDate(`${reportDate}T12:00:00.000Z`)}`
  ].join('\n');

  try {
    await postToDiscord(webhookUrl, content);
    await setSetting(supabase, sentKey, new Date().toISOString());
    await setSetting(supabase, TABLET_DAILY_REPORT_SENT_PREFIX, reportDate);
    await createAuditLog({
      actorUserId,
      action: 'tablet.discord_webhook.daily_report_sent',
      entityType: 'tablet_daily_report',
      entityId: reportDate,
      summary: `Récap Discord tablette envoyé pour ${reportDate}.`,
      newValues: { reportDate, doneCount: doneNames.length, missingCount: missingNames.length }
    });
    return { sent: true, reportDate, doneCount: doneNames.length, missingCount: missingNames.length };
  } catch (error) {
    await logTabletWebhookFailure(supabase, actorUserId, `daily_report:${reportDate}`, error);
    return { sent: false, reportDate, error };
  }
}

export async function getCronActorUserId(supabase: SupabaseClient) {
  const configuredActor = await getSetting(supabase, SYSTEM_ACTOR_KEY);
  if (configuredActor) return configuredActor;

  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id as string | undefined;
}
