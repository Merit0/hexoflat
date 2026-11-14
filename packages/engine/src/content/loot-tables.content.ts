import { lootTableSchema, type LootTable } from '../loot/loot-table';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

export const CAVE_CHEST_TABLE_ID = 'cave-chest-loot';
export const SKELETON_WARRIOR_TABLE_ID = 'skeleton-warrior-loot';
export const SKELETON_ARCHER_TABLE_ID = 'skeleton-archer-loot';
export const SKELETON_KING_TABLE_ID = 'skeleton-king-loot';

export const LOOT_ECONOMY_TARGET = {
  gearKey: HEXOBJECT_KEYS.SWORD,
  runsMin: 2,
  runsMax: 3,
  toleranceRatio: 0.2,
} as const;

const CAVE_CHEST: LootTable = {
  id: CAVE_CHEST_TABLE_ID,
  rolls: [2, 4],
  entries: [
    { itemKey: HEXOBJECT_KEYS.COINS, weight: 5, amount: [10, 30] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 2, amount: [1, 2] },
    { itemKey: HEXOBJECT_KEYS.SHIELD, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.AXE, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.PICKAXE, weight: 1, amount: [1, 1] },
  ],
};

const SKELETON_WARRIOR: LootTable = {
  id: SKELETON_WARRIOR_TABLE_ID,
  rolls: [0, 3],
  entries: [
    { itemKey: HEXOBJECT_KEYS.COINS, weight: 6, amount: [3, 9] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 2, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.BONE_CHARM, weight: 2, amount: [1, 1] },
  ],
};

const SKELETON_ARCHER: LootTable = {
  id: SKELETON_ARCHER_TABLE_ID,
  rolls: [0, 3],
  entries: [
    { itemKey: HEXOBJECT_KEYS.COINS, weight: 6, amount: [3, 9] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 3, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.RETURN_SCROLL, weight: 1, amount: [1, 1] },
  ],
};

const SKELETON_KING: LootTable = {
  id: SKELETON_KING_TABLE_ID,
  rolls: [2, 3],
  guaranteed: [
    { itemKey: HEXOBJECT_KEYS.COINS, amount: [30, 50] },
    { itemKey: HEXOBJECT_KEYS.CROWN_SHARD, amount: [1, 1] },
  ],
  entries: [
    { itemKey: HEXOBJECT_KEYS.SWORD, weight: 1, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.SHIELD, weight: 4, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.RETURN_SCROLL, weight: 3, amount: [1, 1] },
    { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 4, amount: [1, 2] },
  ],
};

export const NOTHING_FIXTURE_TABLE_ID = 'nothing-fixture';

const NOTHING_FIXTURE: LootTable = {
  id: NOTHING_FIXTURE_TABLE_ID,
  rolls: [0, 0],
  entries: [{ itemKey: HEXOBJECT_KEYS.COINS, weight: 1, amount: [1, 1] }],
};

export const LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  [CAVE_CHEST_TABLE_ID]: lootTableSchema.parse(CAVE_CHEST),
  [SKELETON_WARRIOR_TABLE_ID]: lootTableSchema.parse(SKELETON_WARRIOR),
  [SKELETON_ARCHER_TABLE_ID]: lootTableSchema.parse(SKELETON_ARCHER),
  [SKELETON_KING_TABLE_ID]: lootTableSchema.parse(SKELETON_KING),
  [NOTHING_FIXTURE_TABLE_ID]: lootTableSchema.parse(NOTHING_FIXTURE),
};

export function lootTableOf(id: string | undefined): LootTable | null {
  return id ? (LOOT_TABLES[id] ?? null) : null;
}
