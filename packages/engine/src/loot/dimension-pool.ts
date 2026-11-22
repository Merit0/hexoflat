import { availableInDimension } from '../dimensions/availability';
import { BASE_ITEMS } from '../content/base-items.content';
import { CONTENT } from '../content/content-map';
import type { EDimension } from '../dimensions/dimensions';
import type { LootEntry, LootTable } from './loot-table';

export function dropAvailableIn(
  entry: Pick<LootEntry, 'itemKey' | 'baseKey'>,
  dimension: EDimension,
): boolean {
  if (entry.baseKey !== undefined) {
    const base = BASE_ITEMS.find((item) => item.key === entry.baseKey);
    if (!base || base.type !== entry.itemKey)
      throw new Error(`INVALID_BASE_DROP: ${entry.baseKey}`);
    return availableInDimension(base, dimension);
  }
  const bases = BASE_ITEMS.filter((item) => item.type === entry.itemKey);
  if (bases.length) return bases.some((base) => availableInDimension(base, dimension));
  return availableInDimension(CONTENT[entry.itemKey], dimension);
}

/** Validate guaranteed rewards and filter weighted candidates before consuming randomness. */
export function dimensionLootTable(table: LootTable, dimension: EDimension): LootTable {
  for (const entry of table.guaranteed ?? []) {
    if (!dropAvailableIn(entry, dimension))
      throw new Error(
        `GUARANTEED_DROP_OUTSIDE_DIMENSION: ${table.id}:${entry.itemKey}:${dimension}`,
      );
  }
  const entries = table.entries.filter((entry) => dropAvailableIn(entry, dimension));
  if (table.rolls[1] > 0 && entries.length === 0)
    throw new Error(`EMPTY_DIMENSION_LOOT_POOL: ${table.id}:${dimension}`);
  return { ...table, entries };
}
