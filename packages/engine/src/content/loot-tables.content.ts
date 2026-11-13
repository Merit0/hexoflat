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

export const LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  [CAVE_CHEST_TABLE_ID]: lootTableSchema.parse(PROVISIONAL_CAVE_CHEST),
};

export function lootTableOf(id: string | undefined): LootTable | null {
  return id ? (LOOT_TABLES[id] ?? null) : null;
}
