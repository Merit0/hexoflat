import type { InjectionKey } from 'vue';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type { TooltipPrice } from './use-item-tooltip';
import { beginStashDrag, quickMove } from './use-stash-drag';

export interface BoardCellContext {
  begin: (event: PointerEvent, location: TItemLocation, item: InventoryItem) => void;
  quick: (location: TItemLocation, split: boolean) => void;
  priceOf?: (location: TItemLocation) => TooltipPrice | null;
}

export const BOARD_CELL_CONTEXT: InjectionKey<BoardCellContext> = Symbol('board-cell-context');

export const STASH_CELL_CONTEXT: BoardCellContext = {
  begin: beginStashDrag,
  quick: quickMove,
};
