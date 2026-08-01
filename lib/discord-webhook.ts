export function normalizeDiscordWebhookUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const allowedHost = url.hostname === 'discord.com'
      || url.hostname.endsWith('.discord.com')
      || url.hostname === 'discordapp.com'
      || url.hostname.endsWith('.discordapp.com');

    if (url.protocol !== 'https:' || !allowedHost) return '';
    if (!url.pathname.startsWith('/api/webhooks/')) return '';
    if (url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}
