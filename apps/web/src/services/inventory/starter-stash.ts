import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { STARTER_STASH_ITEMS } from '@hexoflat/engine/inventory/stash-constants';
import { emptyStash } from '@hexoflat/engine/inventory/stash-state';
import type { StashCells } from '@/services/persistence/stash-storage';

/** A new hero's stash: the starter gear sits in the first chest, which stays locked until paid for. */
export function starterStashCells(): StashCells {
  const cells: StashCells = emptyStash().cells;
  STARTER_STASH_ITEMS.forEach((key, index) => {
    const item: InventoryItem = {
      id: crypto.randomUUID(),
      key,
      type: getPrototype(key).groupType,
      stackKey: getMeta(key)?.traits?.stackable ? key : undefined,
      amount: 1,
      slotKey: `stash:${index}`,
      isNew: false,
    };
    cells[index] = item;
  });
  return cells;
}
