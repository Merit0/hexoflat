export const LOOT_TIMING = {
  maxTotalMs: 800,
  flightMs: 340,
  accentMs: 120,
  staggerMs: 80,
  arcTiles: 0.4,
  accentScale: 1.2,
  bagRiseTiles: 0.6,
  safetyMs: 400,
} as const;

export interface LootSchedule {
  delaysMs: number[];
  flightMs: number;
  accentMs: number;
  totalMs: number;
}

export function lootSchedule(count: number, leadMs = 0): LootSchedule {
  const { maxTotalMs, flightMs, accentMs, staggerMs } = LOOT_TIMING;
  if (count <= 0) return { delaysMs: [], flightMs, accentMs, totalMs: 0 };
  const own = flightMs + accentMs;
  const budget = Math.max(own, maxTotalMs - leadMs);
  const stagger = count > 1 ? Math.min(staggerMs, (budget - own) / (count - 1)) : 0;
  const delaysMs = Array.from(
    { length: count },
    (_, index) => leadMs + Math.round(index * stagger),
  );
  return {
    delaysMs,
    flightMs,
    accentMs,
    totalMs: Math.min(maxTotalMs, delaysMs[count - 1] + own),
  };
}
