import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { STASH_CAPACITY } from './stash-constants';

export interface IStashState {
  cells: (InventoryItem | null)[];
  capacity: number;
}

export function emptyStash(capacity: number = STASH_CAPACITY): IStashState {
  return { cells: Array.from({ length: capacity }, () => null), capacity };
}
