export const PAWNSHOP_SUD_ALLOWED = ['oeuf de faberge', 'album', 'bouteille', 'livre denfant', 'ventilateur', 'statue maltese falcon'];

// Keep Nord list from previous behavior, but without items now reserved for Sud.
export const PAWNSHOP_NORD_ALLOWED = ['culotte', 'chicha', 'chaine hifi', 'buste grec', 'poids de muscu', 'bouteille de vin rouge', 'bouteille de vin'];

function normalizeItemName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .trim();
}

function includesAny(name: string, entries: string[]) {
  const normalized = normalizeItemName(name);
  return entries.some((entry) => normalized.includes(normalizeItemName(entry)));
}

export function isPawnshopSudAllowed(name: string) {
  return includesAny(name, PAWNSHOP_SUD_ALLOWED);
}

export function isPawnshopNordAllowed(name: string) {
  return includesAny(name, PAWNSHOP_NORD_ALLOWED) && !isPawnshopSudAllowed(name);
}

export function isReservedPawnshopItem(name: string) {
  return isPawnshopSudAllowed(name) || isPawnshopNordAllowed(name);
}
