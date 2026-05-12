export type FourPartnerConfig = {
  id: number;
  partner_one: string;
  partner_two: string;
  partner_three: string;
  off_label: string;
  cycle_start_date: string;
  updated_at?: string;
};

export type FourPartnerCycleDay = {
  date: string;
  label: string;
  position: 1 | 2 | 3 | 4;
  isOff: boolean;
};

export const DEFAULT_FOUR_PARTNER_CONFIG: Omit<FourPartnerConfig, 'id'> = {
  partner_one: 'CANNA CORP',
  partner_two: 'VMF',
  partner_three: 'LOSERRA',
  off_label: 'Day-off',
  cycle_start_date: '2026-05-11'
};

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function daysBetween(startDate: string, targetDate: string) {
  const start = parseDateKey(startDate);
  const target = parseDateKey(targetDate);
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - start.getTime()) / 86400000);
}

export function getFourPartnerCycleDay(config: FourPartnerConfig | Omit<FourPartnerConfig, 'id'>, dateKey = toDateKey()): FourPartnerCycleDay {
  const offset = ((daysBetween(config.cycle_start_date, dateKey) % 4) + 4) % 4;
  const position = (offset + 1) as 1 | 2 | 3 | 4;
  const labels = [config.partner_one, config.partner_two, config.partner_three, config.off_label];
  return { date: dateKey, label: labels[offset] || config.off_label, position, isOff: position === 4 };
}

export function getFourPartnerPreview(config: FourPartnerConfig | Omit<FourPartnerConfig, 'id'>, days = 7, from = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    return getFourPartnerCycleDay(config, toDateKey(date));
  });
}

export function getNextPartnerDay(config: FourPartnerConfig | Omit<FourPartnerConfig, 'id'>, from = new Date()) {
  for (let index = 1; index <= 8; index += 1) {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    const day = getFourPartnerCycleDay(config, toDateKey(date));
    if (!day.isOff) return day;
  }
  return null;
}

export function getNextOffDay(config: FourPartnerConfig | Omit<FourPartnerConfig, 'id'>, from = new Date()) {
  for (let index = 0; index <= 8; index += 1) {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    const day = getFourPartnerCycleDay(config, toDateKey(date));
    if (day.isOff) return day;
  }
  return null;
}
