export const PROCESSOR_COST_PER_BOTTLE = 300;
export const PROCESSOR_UNITS_PER_BOTTLE = 25;
export const PROCESSOR_PRICE_PER_UNIT = 100;
export const PROCESSOR_AVERAGE_RATE = 0.5;
export const PROCESSOR_BOAT_FEE = 1500;
export const PROCESSOR_BOAT_FROM_BOTTLES = 10;
export const PROCESSOR_BOAT_CAPACITY = 12;

export function computeProcessorEstimates(bottles: number, includeBoatFee: boolean) {
  const safeBottles = Math.max(0, Math.floor(Number.isFinite(bottles) ? bottles : 0));
  const processors = safeBottles * PROCESSOR_UNITS_PER_BOTTLE;
  const materialCost = safeBottles * PROCESSOR_COST_PER_BOTTLE;
  const boatFee = includeBoatFee ? PROCESSOR_BOAT_FEE : 0;
  const totalCost = materialCost + boatFee;
  const gainMax = processors * PROCESSOR_PRICE_PER_UNIT;
  const gainAverage = Math.round(gainMax * PROCESSOR_AVERAGE_RATE);
  return {
    bottles: safeBottles,
    vehicleSuggested: safeBottles >= PROCESSOR_BOAT_FROM_BOTTLES ? 'boat' : 'car',
    processors,
    materialCost,
    boatFee,
    totalCost,
    gainAverage,
    gainMax,
    profitAverage: gainAverage - totalCost,
    profitMax: gainMax - totalCost
  };
}
