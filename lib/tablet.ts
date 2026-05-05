const TABLET_TIME_ZONE = 'Europe/Paris';

function parisParts(input: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TABLET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(input);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

export function getTabletParisHour(input = new Date()) {
  return parisParts(input).hour;
}

export function getTabletBusinessDate(input = new Date()) {
  const parts = parisParts(input);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < 8) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
