import { dimensionLootTable } from './dimension-pool';
import type { EDimension } from '../dimensions/dimensions';
import type { RandomNumberGenerator } from '../utils/random';
import type { LootDrop, LootEntry, LootTable, WeightedLootEntry } from './loot-table';

export function lootStreamLabel(sourceId: string, targetKey: string): string {
  return `loot:${sourceId}:${targetKey}`;
}

function intInRange(min: number, max: number, rng: RandomNumberGenerator): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function guaranteedDrop(entry: LootEntry, rng: RandomNumberGenerator): LootDrop {
  return {
    itemKey: entry.itemKey,
    ...(entry.baseKey ? { baseKey: entry.baseKey } : {}),
    amount: intInRange(entry.amount[0], entry.amount[1], rng),
    guaranteed: true,
  };
}

function pickWeighted(
  entries: readonly WeightedLootEntry[],
  rng: RandomNumberGenerator,
): WeightedLootEntry {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let point = rng() * total;
  for (const entry of entries) {
    if (point < entry.weight) return entry;
    point -= entry.weight;
  }
  return entries[entries.length - 1];
}

export function rollLoot(
  table: LootTable,
  rng: RandomNumberGenerator,
  dimension?: EDimension,
): LootDrop[] {
  if (dimension !== undefined) table = dimensionLootTable(table, dimension);
  const rolls = intInRange(table.rolls[0], table.rolls[1], rng);
  const drops = (table.guaranteed ?? []).map((entry) => guaranteedDrop(entry, rng));
  for (let roll = 0; roll < rolls; roll += 1) {
    const entry = pickWeighted(table.entries, rng);
    drops.push({
      itemKey: entry.itemKey,
      ...(entry.baseKey ? { baseKey: entry.baseKey } : {}),
      amount: intInRange(entry.amount[0], entry.amount[1], rng),
      guaranteed: false,
    });
  }
  return drops;
}
