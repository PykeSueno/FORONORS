import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuditLog } from './audit-log';
import { formatParisDate, formatParisDateTime, getTabletBusinessDate } from './tablet';

export const TABLET_WEBHOOK_KEY = 'discord.tablet_webhook_url';
const TABLET_PASSAGE_SENT_PREFIX = 'tablet_passage_discord_sent';
const TABLET_DAILY_REPORT_SENT_PREFIX = 'tablet_daily_report_sent';
const TABLET_MORNING_SENT_PREFIX = 'tablet_morning_report_sent';
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
type TabletDay = {
  id: number;
  business_day: string;
  deposited_amount: number;
  chest_amount: number;
  initial_kits: number;
  initial_cutters: number;
  kits_added: number;
  cutters_added: number;
};

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
    action: 'tablet.webhook.failed',
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
    '📱 **Passage tablette validé**',
    '',
    `👤 Membre : ${passage.member_label}`,
    `💸 Dépôt : ${formatMoney(Number(passage.before_cash))} → ${formatMoney(Number(passage.after_cash))}`,
    `📦 Kits : ${passage.before_kits} → ${passage.after_kits}`,
    `🛠️ Disqueuses : ${passage.before_cutters} → ${passage.after_cutters}`,
    '💰 Coût passage : -$400',
    `🕒 Date : ${formatParisDateTime(passage.created_at)}`
  ].join('\n');

  try {
    await postToDiscord(webhookUrl, content);
    await setSetting(supabase, sentKey, new Date().toISOString());
    await createAuditLog({
      actorUserId,
      action: 'tablet.webhook.pass_sent',
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

export async function sendTabletMorningReport(supabase: SupabaseClient, actorUserId: string, day: TabletDay) {
  const webhookUrl = await getTabletWebhookUrl(supabase);
  if (!webhookUrl) return { skipped: true, reason: 'not_configured', reportDate: day.business_day };

  const sentKey = markerKey(TABLET_MORNING_SENT_PREFIX, day.business_day);
  if (await getSetting(supabase, sentKey)) return { skipped: true, reason: 'already_sent', reportDate: day.business_day };

  const { data: activeMembers } = await supabase.from('users').select('id').eq('is_active', true);
  const content = [
    '📱 **Tablette du jour**',
    '',
    `💰 Coffre tablette : **${formatMoney(Number(day.deposited_amount || day.chest_amount || 4000))}**`,
    '📦 Objectif : faire la tablette aujourd’hui',
    `👥 Membres concernés : ${activeMembers?.length ?? 0} membres actifs`,
    '',
    `Bonjour, la tablette du jour est ouverte. ${formatMoney(Number(day.deposited_amount || day.chest_amount || 4000))} sont dans le coffre. Pensez à faire votre passage tablette.`
  ].join('\n');

  try {
    await postToDiscord(webhookUrl, content);
    await setSetting(supabase, sentKey, new Date().toISOString());
    await createAuditLog({
      actorUserId,
      action: 'tablet.webhook.morning_sent',
      entityType: 'tablet_day',
      entityId: day.business_day,
      summary: `Message Discord tablette du matin envoyé pour ${day.business_day}.`,
      newValues: { reportDate: day.business_day, activeMembers: activeMembers?.length ?? 0 }
    });
    return { sent: true, reportDate: day.business_day };
  } catch (error) {
    await logTabletWebhookFailure(supabase, actorUserId, `morning:${day.business_day}`, error);
    return { sent: false, reportDate: day.business_day, error };
  }
}

export async function sendTabletDailyReport(supabase: SupabaseClient, actorUserId: string, reportDate = getTabletBusinessDate()) {
  const webhookUrl = await getTabletWebhookUrl(supabase);
  if (!webhookUrl) return { skipped: true, reason: 'not_configured', reportDate };

  const sentKey = markerKey(TABLET_DAILY_REPORT_SENT_PREFIX, reportDate);
  if (await getSetting(supabase, sentKey)) return { skipped: true, reason: 'already_sent', reportDate };

  const [{ data: activeMembers }, { data: day }] = await Promise.all([
    supabase.from('users').select('id, name, username').eq('is_active', true).order('username', { ascending: true }),
    supabase.from('tablet_days').select('id, business_day, deposited_amount, chest_amount, initial_kits, initial_cutters, kits_added, cutters_added').eq('business_day', reportDate).maybeSingle()
  ]);

  const members = (activeMembers ?? []) as ActiveMember[];
  const typedDay = day as TabletDay | null;
  const { data: passages } = day?.id
    ? await supabase.from('tablet_passages').select('member_user_id, member_label').eq('tablet_day_id', day.id)
    : { data: [] };

  const doneIds = new Set((passages ?? []).map((passage) => passage.member_user_id).filter(Boolean) as string[]);
  const doneNames = members.filter((member) => doneIds.has(member.id)).map((member) => member.name || member.username);
  const missingNames = members.filter((member) => !doneIds.has(member.id)).map((member) => member.name || member.username);
  const initialKits = Number(typedDay?.initial_kits ?? 0);
  const initialCutters = Number(typedDay?.initial_cutters ?? 0);
  const finalKits = initialKits + Number(typedDay?.kits_added ?? 0);
  const finalCutters = initialCutters + Number(typedDay?.cutters_added ?? 0);

  const content = [
    '📋 **Récap tablette du jour**',
    '',
    '✅ Ont fait la tablette :',
    formatList(doneNames),
    '',
    '❌ N’ont pas fait la tablette :',
    formatList(missingNames),
    '',
    `💰 Coffre départ : ${formatMoney(Number(typedDay?.deposited_amount ?? 0))}`,
    `💰 Coffre restant : ${formatMoney(Number(typedDay?.chest_amount ?? 0))}`,
    `📦 Kits départ → fin : ${initialKits} → ${finalKits}`,
    `🛠️ Disqueuses départ → fin : ${initialCutters} → ${finalCutters}`,
    '',
    `📅 Date : ${formatParisDate(`${reportDate}T12:00:00.000Z`)}`
  ].join('\n');

  try {
    await postToDiscord(webhookUrl, content);
    await setSetting(supabase, sentKey, new Date().toISOString());
    await setSetting(supabase, TABLET_DAILY_REPORT_SENT_PREFIX, reportDate);
    await createAuditLog({
      actorUserId,
      action: 'tablet.webhook.daily_report_sent',
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
