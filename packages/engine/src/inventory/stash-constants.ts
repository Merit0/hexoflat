export const STASH_COLUMNS = 7;
export const STASH_ROWS = 6;
export const STASH_CHEST_CELLS = STASH_COLUMNS * STASH_ROWS;
export const STASH_MAX_CHESTS = 5;
export const STASH_CAPACITY = STASH_CHEST_CELLS * STASH_MAX_CHESTS;

export const STASH_CHEST_PRICES: readonly number[] = [100, 1000, 1000, 1000, 1000];

export function stashChestPrice(owned: number): number | null {
  return STASH_CHEST_PRICES[owned] ?? null;
}
