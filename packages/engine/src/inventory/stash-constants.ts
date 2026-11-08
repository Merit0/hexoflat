import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';

export const STASH_COLUMNS = 7;
export const STASH_ROWS = 6;
export const STASH_CHEST_CELLS = STASH_COLUMNS * STASH_ROWS;
export const STASH_MAX_CHESTS = 5;
export const STASH_CAPACITY = STASH_CHEST_CELLS * STASH_MAX_CHESTS;

export const STASH_CHEST_PRICES: readonly number[] = [100, 1000, 1000, 1000, 1000];

export function stashChestPrice(owned: number): number | null {
  return STASH_CHEST_PRICES[owned] ?? null;
}

/** What lies in the first, locked chest for a new hero: the gear that used to lie on the camp map. */
export const STARTER_STASH_ITEMS: readonly THexobjectKey[] = [
  HEXOBJECT_KEYS.SWORD,
  HEXOBJECT_KEYS.AXE,
  HEXOBJECT_KEYS.SHIELD,
  HEXOBJECT_KEYS.PICKAXE,
];
