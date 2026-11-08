import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { STARTER_STASH_ITEMS, STASH_CHEST_CELLS } from '@hexoflat/engine/inventory/stash-constants';
import type { StashCells } from '@/services/persistence/stash-storage';

function starterItem(key: InventoryItem['key'], index: number): InventoryItem {
  return {
    id: crypto.randomUUID(),
    key,
    type: getPrototype(key).groupType,
    stackKey: getMeta(key)?.traits?.stackable ? key : undefined,
    amount: 1,
    slotKey: `stash:${index}`,
    isNew: false,
  };
}

/**
 * Puts the starter gear into the first free cells of the first chest. Cells that already hold
 * something are never touched, and a piece with no free cell left is simply not given.
 */
export function grantStarterGear(cells: StashCells): StashCells {
  const next = cells.slice();
  for (const key of STARTER_STASH_ITEMS) {
    const free = next.slice(0, STASH_CHEST_CELLS).findIndex((cell) => cell === null);
    if (free !== -1) next[free] = starterItem(key, free);
  }
  return next;
}
