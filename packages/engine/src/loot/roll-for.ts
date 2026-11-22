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
}

export function rollLootLists(
  tables: readonly (LootTable | null | undefined)[],
  source: LootRollSource,
): LootDrop[][] {
  const scoped = tables.flatMap((table) =>
    table
      ? [source.dimension === undefined ? table : dimensionLootTable(table, source.dimension)]
      : [],
  );
  const rng = deriveStream(source.seed, lootStreamLabel(source.sourceId, source.targetKey));
  return scoped.map((table) => rollLoot(table, rng));
}

export function rollLootList(
  table: LootTable | null | undefined,
  source: LootRollSource,
): LootDrop[] {
  return rollLootLists([table], source)[0] ?? [];
}
