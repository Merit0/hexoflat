import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';

export const STASH_COLUMNS = 7;
export const STASH_ROWS = 6;
export const STASH_CHEST_CELLS = STASH_COLUMNS * STASH_ROWS;
export const STASH_MAX_CHESTS = 5;
export const STASH_CAPACITY = STASH_CHEST_CELLS * STASH_MAX_CHESTS;

/** Chest 1 is the free camp reward (`CLAIM_CAMP_CHEST`), the rest are bought in order. */
export const STASH_CHEST_PRICES: readonly number[] = [0, 100, 1000, 1000, 1000];

export function stashChestPrice(owned: number): number | null {
  return STASH_CHEST_PRICES[owned] ?? null;
}

/** What lies in the camp chest the hero opens once, for free. */
export const CAMP_CHEST_ITEMS: readonly THexobjectKey[] = [
  HEXOBJECT_KEYS.SWORD,
  HEXOBJECT_KEYS.AXE,
  HEXOBJECT_KEYS.SHIELD,
  HEXOBJECT_KEYS.PICKAXE,
];
