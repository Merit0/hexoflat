import { lootTableSchema, type LootTable } from '../loot/loot-table';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

export const CAVE_CHEST_TABLE_ID = 'cave-chest-provisional';

const PROVISIONAL_CAVE_CHEST: LootTable = {
  id: CAVE_CHEST_TABLE_ID,
  rolls: [2, 4],
  entries: [
    { itemKey: HEXOBJECT_KEYS.COINS, weight: 6, amount: [10, 40] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 3, amount: [1, 2] },
    { itemKey: HEXOBJECT_KEYS.BONE_CHARM, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.SHIELD, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.AXE, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.PICKAXE, weight: 1, amount: [1, 1] },
  ],
};

export const SKELETON_WARRIOR_TABLE_ID = 'skeleton-warrior-provisional';
export const SKELETON_ARCHER_TABLE_ID = 'skeleton-archer-provisional';
export const SKELETON_KING_TABLE_ID = 'skeleton-king-provisional';

const PROVISIONAL_WARRIOR: LootTable = {
  id: SKELETON_WARRIOR_TABLE_ID,
  rolls: [1, 2],
  entries: [
    { itemKey: HEXOBJECT_KEYS.COINS, weight: 6, amount: [5, 20] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 2, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.BONE_CHARM, weight: 2, amount: [1, 1] },
  ],
};

const PROVISIONAL_ARCHER: LootTable = {
  id: SKELETON_ARCHER_TABLE_ID,
  rolls: [1, 2],
  entries: [
    { itemKey: HEXOBJECT_KEYS.COINS, weight: 6, amount: [5, 20] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 3, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.RETURN_SCROLL, weight: 1, amount: [1, 1] },
  ],
};

const PROVISIONAL_KING: LootTable = {
  id: SKELETON_KING_TABLE_ID,
  rolls: [3, 4],
  guaranteed: [
    { itemKey: HEXOBJECT_KEYS.COINS, amount: [30, 60] },
    { itemKey: HEXOBJECT_KEYS.CROWN_SHARD, amount: [1, 1] },
  ],
  entries: [
    { itemKey: HEXOBJECT_KEYS.SWORD, weight: 2, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.SHIELD, weight: 2, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.RETURN_SCROLL, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 3, amount: [1, 2] },
  ],
};

export const LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  [CAVE_CHEST_TABLE_ID]: lootTableSchema.parse(PROVISIONAL_CAVE_CHEST),
  [SKELETON_WARRIOR_TABLE_ID]: lootTableSchema.parse(PROVISIONAL_WARRIOR),
  [SKELETON_ARCHER_TABLE_ID]: lootTableSchema.parse(PROVISIONAL_ARCHER),
  [SKELETON_KING_TABLE_ID]: lootTableSchema.parse(PROVISIONAL_KING),
};

export function lootTableOf(id: string | undefined): LootTable | null {
  return id ? (LOOT_TABLES[id] ?? null) : null;
}
