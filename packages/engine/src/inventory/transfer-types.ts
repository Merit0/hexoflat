import type { TEquipSlot } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';

export type TItemCells = (InventoryItem | null)[];
export type TEquipment = Record<TEquipSlot, InventoryItem | null>;

/**
 * The three places an item can be. `slotKey` and `isNew` on the items are owned by the
 * web adapter: the rules here never read them and never rewrite them.
 */
export interface IInventoryAggregate {
  bag: TItemCells;
  equip: TEquipment;
  stash: TItemCells;
}

export type TTransferKind =
  'move' | 'swap' | 'merge' | 'split' | 'equip' | 'auto' | 'store' | 'sort' | 'noop';

export type TTransferError =
  | 'WRONG_SLOT'
  | 'SWAP_WRONG_SLOT'
  | 'STACK_FULL'
  | 'SPLIT_TARGET_TAKEN'
  | 'OVERWEIGHT'
  | 'CONTAINER_FULL'
  | 'STASH_LOCKED'
  | 'NO_CHEST'
  | 'EMPTY_SOURCE'
  | 'INVALID_LOCATION';

/**
 * `kind: 'noop'` means nothing changed (`next` is the very same aggregate), so the UI can
 * skip the landing animation. `moved` is how many items or stacks changed place.
 */
export type TTransferResult =
  | { ok: true; next: IInventoryAggregate; kind: TTransferKind; moved: number }
  | { ok: false; reason: TTransferError };

export interface ICellRange {
  start: number;
  end: number;
}

export interface ITransferOptions {
  split: boolean;
  capacityKg: number;
  stashOpen: boolean;
  newId: () => string;
  stashPreferred?: ICellRange;
}

export interface IStashActionOptions {
  stashOpen: boolean;
  stashPreferred?: ICellRange;
}
