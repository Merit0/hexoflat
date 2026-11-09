import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { placeStarterGear } from '@hexoflat/engine/inventory/inventory-state';
import { STASH_CHEST_CELLS } from '@hexoflat/engine/inventory/stash-constants';
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

export function grantStarterGear(cells: StashCells): StashCells {
  return placeStarterGear(cells, STASH_CHEST_CELLS, starterItem);
}
