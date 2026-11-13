export const LOOT_TIMING = {
  maxTotalMs: 800,
  flightMs: 360,
  staggerMs: 90,
  bagRiseTiles: 0.6,
  safetyMs: 400,
} as const;

export interface LootSchedule {
  delaysMs: number[];
  flightMs: number;
  totalMs: number;
}

export function lootSchedule(count: number): LootSchedule {
  const { maxTotalMs, flightMs, staggerMs } = LOOT_TIMING;
  if (count <= 0) return { delaysMs: [], flightMs, totalMs: 0 };
  const stagger = count > 1 ? Math.min(staggerMs, (maxTotalMs - flightMs) / (count - 1)) : 0;
  const delaysMs = Array.from({ length: count }, (_, index) => Math.round(index * stagger));
  return { delaysMs, flightMs, totalMs: Math.min(maxTotalMs, delaysMs[count - 1] + flightMs) };
}
