import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type { TTransferResult } from '@hexoflat/engine/inventory/item-transfer';
import {
  autoPlaceItem,
  moveItem,
  previewAutoPlace,
  previewMove,
  readInventoryAggregate,
} from '@/services/inventory/stash-transfer';
import { hideItemTooltip } from '@/composables/use-item-tooltip';
import { resolveDropTarget } from './stash-drop-target';
import {
  locationKey,
  resetStashDrag,
  stashDrag,
  stashFx,
  type StashDropTarget,
} from './stash-drag-state';
import { stashErrorText, warnHero } from './stash-messages';
import {
  flashFor,
  setGrabbing,
  startEdgeScroll,
  trackPointerDrag,
  type DragPoint,
} from './board-drag-core';

const BLINK_MS = 1000;

export type { DragPoint };

let targetKey = '';
let stopScroll: (() => void) | null = null;
let stopListening: (() => void) | null = null;

function flash(slot: 'landed' | 'shake', key: string): void {
  flashFor(stashFx, slot, key);
}

export function blinkWeight(): void {
  stashFx.blinkWeight = true;
  setTimeout(() => (stashFx.blinkWeight = false), BLINK_MS);
}

export function targetKeyOf(target: StashDropTarget | null): string {
  if (!target) return '';
  return target.kind === 'cell' ? locationKey(target.at) : `zone:${target.container}`;
}

function otherContainer(from: TItemLocation): 'bag' | 'stash' {
  return from.container === 'stash' ? 'bag' : 'stash';
}

export function previewFor(
  from: TItemLocation,
  target: StashDropTarget,
  split: boolean,
): TTransferResult {
  return target.kind === 'cell'
    ? previewMove(from, target.at, split)
    : previewAutoPlace(from, target.container, split);
}

function findNextHint(from: TItemLocation, split: boolean): TItemLocation | null {
  const container = otherContainer(from);
  const result = previewAutoPlace(from, container, split);
  if (!result.ok || result.kind === 'noop') return null;
  const now = readInventoryAggregate();
  const before = container === 'bag' ? now.bag : now.stash;
  const after = container === 'bag' ? result.next.bag : result.next.stash;
  const index = after.findIndex((cell, at) => cell !== before[at]);
  return index === -1 ? null : { container, index };
}

export function dragBegin(
  from: TItemLocation,
  item: InventoryItem,
  point: DragPoint,
  split: boolean,
): void {
  hideItemTooltip();
  targetKey = '';
  Object.assign(stashDrag, {
    active: true,
    item,
    from,
    split,
    x: point.x,
    y: point.y,
    offsetX: point.offsetX,
    offsetY: point.offsetY,
    width: point.width,
    height: point.height,
    target: null,
    preview: null,
    nextHint: findNextHint(from, split),
  });
  setGrabbing(true);
}

export function dragMoveTo(target: StashDropTarget | null): void {
  const key = targetKeyOf(target);
  if (key === targetKey || !stashDrag.from) return;
  targetKey = key;
  stashDrag.target = target;
  stashDrag.preview = target ? previewFor(stashDrag.from, target, stashDrag.split) : null;
}

export function dragCancel(): void {
  stopScroll?.();
  stopScroll = null;
  stopListening?.();
  stopListening = null;
  targetKey = '';
  setGrabbing(false);
  resetStashDrag();
}

export function dragRelease(): void {
  const { from, target, preview, split } = stashDrag;
  dragCancel();
  if (!from || !target || !preview) return;
  const home = target.kind === 'cell' ? locationKey(target.at) : locationKey(from);
  if (!preview.ok) {
    warnHero(stashErrorText(preview.reason));
    flash('shake', home);
    if (preview.reason === 'OVERWEIGHT') blinkWeight();
    return;
  }
  if (preview.kind === 'noop') return;
  const result =
    target.kind === 'cell'
      ? moveItem(from, target.at, split)
      : autoPlaceItem(from, target.container, split);
  if (!result.ok) {
    warnHero(stashErrorText(result.reason));
    flash('shake', home);
    return;
  }
  if (target.kind === 'cell') flash('landed', locationKey(target.at));
}

export function quickMove(from: TItemLocation, split = false): void {
  const container = otherContainer(from);
  const result = autoPlaceItem(from, container, split);
  if (!result.ok) {
    warnHero(stashErrorText(result.reason));
    flash('shake', locationKey(from));
    if (result.reason === 'OVERWEIGHT') blinkWeight();
    return;
  }
}

function pointedTarget(x: number, y: number): StashDropTarget | null {
  return resolveDropTarget(document.elementsFromPoint(x, y));
}

function draggedPointer(): { x: number; y: number } | null {
  return stashDrag.active ? { x: stashDrag.x, y: stashDrag.y } : null;
}

export function beginStashDrag(
  event: PointerEvent,
  from: TItemLocation,
  item: InventoryItem,
): void {
  if (event.button !== 0 || stashDrag.active) return;
  const split = event.shiftKey;
  stopListening = trackPointerDrag(event, {
    start: (point) => {
      dragBegin(from, item, point, split);
      stopScroll = startEdgeScroll(draggedPointer, () =>
        dragMoveTo(pointedTarget(stashDrag.x, stashDrag.y)),
      );
    },
    move: (x, y) => {
      stashDrag.x = x;
      stashDrag.y = y;
      dragMoveTo(pointedTarget(x, y));
    },
    release: dragRelease,
    cancel: dragCancel,
  });
}
