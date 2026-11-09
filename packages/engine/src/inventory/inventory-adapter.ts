import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import type { InventoryState, InventoryStateItem } from './inventory-state';
import { STASH_CHEST_CELLS } from './stash-constants';
import type { ICellRange, IInventoryAggregate, TEquipment } from './transfer-types';

function widen(item: InventoryStateItem | null): InventoryItem | null {
  return item ? { ...item, slotKey: '', isNew: false } : null;
}

function slim(item: InventoryItem | null): InventoryStateItem | null {
  if (!item) return null;
  const { id, key, type, stackKey, amount } = item;
  return { id, key, type, ...(stackKey ? { stackKey } : {}), amount };
}

/** The rules' view: the stash holds only the cells of the chests that are open. */
export function toAggregate(state: InventoryState): IInventoryAggregate {
  const equip = {} as TEquipment;
  for (const slot of EQUIP_SLOTS) equip[slot] = widen(state.equip[slot]);
  return {
    bag: state.bag.map(widen),
    equip,
    stash: state.stash.cells.slice(0, state.stash.chests * STASH_CHEST_CELLS).map(widen),
  };
}

/**
 * Writes the rules' result back. Cells of chests that were closed before the command keep what
 * they held (the starter gear waits in the locked first chest), so only the open cells are
 * replaced. Pure: `state` is not touched.
 */
export function applyAggregate(state: InventoryState, agg: IInventoryAggregate): InventoryState {
  const equip = {} as InventoryState['equip'];
  for (const slot of EQUIP_SLOTS) equip[slot] = slim(agg.equip[slot]);
  const wasOpen = state.stash.chests * STASH_CHEST_CELLS;
  return {
    ...state,
    bag: agg.bag.map(slim),
    equip,
    stash: {
      ...state.stash,
      chests: agg.stash.length / STASH_CHEST_CELLS,
      cells: state.stash.cells.map((cell, index) =>
        index < wasOpen ? slim(agg.stash[index] ?? null) : cell,
      ),
    },
  };
}

export function chestRange(chest: number | undefined): ICellRange | undefined {
  if (chest === undefined) return undefined;
  const start = chest * STASH_CHEST_CELLS;
  return { start, end: start + STASH_CHEST_CELLS };
}
