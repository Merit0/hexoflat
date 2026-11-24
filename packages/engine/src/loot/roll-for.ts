import { dimensionLootTable } from './dimension-pool';
import type { EDimension } from '../dimensions/dimensions';
import { deriveStream } from '../utils/random-seeded';
import type { LootDrop, LootTable } from './loot-table';
import { lootStreamLabel, rollLoot } from './roll-loot';

export interface LootRollSource {
  seed: string;
  sourceId: string;
  targetKey: string;
  dimension?: EDimension;
  dimensions?: readonly (EDimension | undefined)[];
}

export function rollLootLists(
  tables: readonly (LootTable | null | undefined)[],
  source: LootRollSource,
): LootDrop[][] {
  const scoped = tables.flatMap((table, index) => {
    if (!table) return [];
    const dimension = source.dimensions?.[index] ?? source.dimension;
    return [dimension === undefined ? table : dimensionLootTable(table, dimension)];
  });
  const rng = deriveStream(source.seed, lootStreamLabel(source.sourceId, source.targetKey));
  return scoped.map((table) => rollLoot(table, rng));
}

export function rollLootList(
  table: LootTable | null | undefined,
  source: LootRollSource,
): LootDrop[] {
  return rollLootLists([table], source)[0] ?? [];
}
