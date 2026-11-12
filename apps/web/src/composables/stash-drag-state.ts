import { reactive } from 'vue';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type { TTransferResult } from '@hexoflat/engine/inventory/item-transfer';

export type StashDropTarget =
  { kind: 'cell'; at: TItemLocation } | { kind: 'zone'; container: 'bag' | 'stash' };

export interface StashDragState {
  active: boolean;
  item: InventoryItem | null;
  from: TItemLocation | null;
  split: boolean;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  target: StashDropTarget | null;
  preview: TTransferResult | null;
  nextHint: TItemLocation | null;
}

function idleDrag(): StashDragState {
  return {
    active: false,
    item: null,
    from: null,
    split: false,
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    height: 0,
    target: null,
    preview: null,
    nextHint: null,
  };
}

export const stashDrag = reactive<StashDragState>(idleDrag());

export const stashFx = reactive<{
  landed: string | null;
  shake: string | null;
  blinkWeight: boolean;
}>({ landed: null, shake: null, blinkWeight: false });

export function resetStashDrag(): void {
  Object.assign(stashDrag, idleDrag());
}

export function locationKey(at: TItemLocation): string {
  return at.container === 'equip' ? `equip:${at.slot}` : `${at.container}:${at.index}`;
}

export interface BoardCellState {
  lifted: boolean;
  next: boolean;
  valid: boolean;
  invalid: boolean;
}

export function stashCellState(at: TItemLocation): BoardCellState {
  const key = locationKey(at);
  const isTarget =
    stashDrag.active &&
    stashDrag.target?.kind === 'cell' &&
    locationKey(stashDrag.target.at) === key;
  const lifted = stashDrag.active && !!stashDrag.from && locationKey(stashDrag.from) === key;
  const next = stashDrag.active && !!stashDrag.nextHint && locationKey(stashDrag.nextHint) === key;
  return {
    lifted,
    next: next && !isTarget,
    valid: isTarget && !!stashDrag.preview?.ok && stashDrag.preview.kind !== 'noop',
    invalid: isTarget && stashDrag.preview?.ok === false,
  };
}
