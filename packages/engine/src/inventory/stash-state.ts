import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { STASH_CAPACITY, STASH_CHEST_CELLS, STASH_MAX_CHESTS } from './stash-constants';

export interface IStashState {
  cells: (InventoryItem | null)[];
  chests: number;
}

export function emptyStash(chests = 0): IStashState {
  return {
    cells: Array.from({ length: STASH_CAPACITY }, () => null),
    chests: Math.min(STASH_MAX_CHESTS, Math.max(0, chests)),
  };
}

export function openStashCells(state: IStashState): (InventoryItem | null)[] {
  return state.cells.slice(0, state.chests * STASH_CHEST_CELLS);
}
