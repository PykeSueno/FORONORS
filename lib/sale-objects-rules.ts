export const PAWNSHOP_SUD_ALLOWED = ['oeuf de faberge', 'album', 'bouteille', 'livre denfant', 'ventilateur', 'statue maltese falcon'];
export const PAWNSHOP_NORD_ALLOWED = ['culotte', 'chicha', 'chaine hifi', 'buste grec', 'poids de muscu', 'bouteille de vin rouge', 'bouteille de vin'];

export type SaleObjectRouting = 'group' | 'pawnshop_nord' | 'pawnshop_sud';

function normalizeItemName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').toLowerCase().trim();
}

function includesAny(name: string, entries: string[]) {
  const normalized = normalizeItemName(name);
  return entries.some((entry) => normalized.includes(normalizeItemName(entry)));
}

export function defaultRoutingForItem(name: string): SaleObjectRouting {
  if (includesAny(name, PAWNSHOP_SUD_ALLOWED)) return 'pawnshop_sud';
  if (includesAny(name, PAWNSHOP_NORD_ALLOWED)) return 'pawnshop_nord';
  return 'group';
}

export function resolveItemRouting(item: { id: number; name: string }, customRouting?: Record<string, SaleObjectRouting>) {
  return customRouting?.[String(item.id)] ?? defaultRoutingForItem(item.name);
}
