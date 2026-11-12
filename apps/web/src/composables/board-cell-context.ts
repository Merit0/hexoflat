import type { InjectionKey } from 'vue';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type { TooltipPrice } from './use-item-tooltip';
import { stashCellState, type BoardCellState } from './stash-drag-state';
import { stashZoneClass } from './use-stash-zone-class';
import { beginStashDrag, quickMove } from './use-stash-drag';

export type { BoardCellState };

export interface BoardCellContext {
  begin: (event: PointerEvent, location: TItemLocation, item: InventoryItem) => void;
  quick: (location: TItemLocation, split: boolean) => void;
  stateOf: (location: TItemLocation) => BoardCellState;
  zoneClassOf: (zone: 'bag') => string;
  priceOf?: (location: TItemLocation) => TooltipPrice | null;
  select?: (location: TItemLocation, item: InventoryItem) => void;
  isSelected?: (location: TItemLocation, item: InventoryItem) => boolean;
  forecastKg?: () => string | null;
}

export const BOARD_CELL_CONTEXT: InjectionKey<BoardCellContext> = Symbol('board-cell-context');

export const STASH_CELL_CONTEXT: BoardCellContext = {
  begin: beginStashDrag,
  quick: quickMove,
  stateOf: stashCellState,
  zoneClassOf: stashZoneClass,
};
