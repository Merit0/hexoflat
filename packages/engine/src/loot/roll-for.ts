import { deriveStream } from '../utils/random-seeded';
import type { LootDrop, LootTable } from './loot-table';
import { lootStreamLabel, rollLoot } from './roll-loot';

export interface LootRollSource {
  seed: string;
  sourceId: string;
  targetKey: string;
}

export function rollLootLists(
  tables: readonly (LootTable | null | undefined)[],
  source: LootRollSource,
): LootDrop[][] {
  const rng = deriveStream(source.seed, lootStreamLabel(source.sourceId, source.targetKey));
  return tables.flatMap((table) => (table ? [rollLoot(table, rng)] : []));
}

export function rollLootList(
  table: LootTable | null | undefined,
  source: LootRollSource,
): LootDrop[] {
  return rollLootLists([table], source)[0] ?? [];
}
