export function getTabletBusinessDate(input = new Date()) {
  const date = new Date(input);
  const hour = date.getHours();
  if (hour < 8) date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
