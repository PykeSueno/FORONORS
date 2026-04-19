export const CIGARETTE_ITEM_NAME = 'Paquet de Cigarette';
export const CIGARETTE_SALE_QTY = 62;
export const CIGARETTE_REVENUE = 992;
export const CIGARETTE_DAILY_PACKS = 620;

export function getCigaretteResetHour() {
  const raw = Number(process.env.CIGARETTE_RESET_HOUR ?? 4);
  if (!Number.isFinite(raw)) return 4;
  return Math.min(23, Math.max(0, Math.trunc(raw)));
}

export function getCigaretteBusinessDate(input = new Date()) {
  const date = new Date(input);
  if (date.getHours() < getCigaretteResetHour()) date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isCigarettePassageHourAllowed(input = new Date()) {
  const hour = input.getHours();
  return hour >= 4 && hour < 20;
}
