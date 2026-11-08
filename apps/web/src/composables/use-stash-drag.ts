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

const DRAG_THRESHOLD_PX = 4;
const EDGE_BAND_PX = 40;
const MAX_SCROLL_STEP_PX = 14;
const FX_MS = 320;
const BLINK_MS = 1000;
const GRABBING_CLASS = 'is-grabbing';

export interface DragPoint {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

let targetKey = '';
let scrollFrame: number | null = null;
let stopListening: (() => void) | null = null;

function flash(slot: 'landed' | 'shake', key: string): void {
  stashFx[slot] = key;
  setTimeout(() => {
    if (stashFx[slot] === key) stashFx[slot] = null;
  }, FX_MS);
}

function blinkWeight(): void {
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
  document.documentElement.classList.add(GRABBING_CLASS);
}

export function dragMoveTo(target: StashDropTarget | null): void {
  const key = targetKeyOf(target);
  if (key === targetKey || !stashDrag.from) return;
  targetKey = key;
  stashDrag.target = target;
  stashDrag.preview = target ? previewFor(stashDrag.from, target, stashDrag.split) : null;
}

export function dragCancel(): void {
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
  scrollFrame = null;
  stopListening?.();
  stopListening = null;
  targetKey = '';
  document.documentElement.classList.remove(GRABBING_CLASS);
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

function scrollNearEdges(): void {
  if (!stashDrag.active) return;
  for (const box of document.querySelectorAll<HTMLElement>('[data-scroller]')) {
    const rect = box.getBoundingClientRect();
    if (stashDrag.x < rect.left || stashDrag.x > rect.right) continue;
    const fromTop = stashDrag.y - rect.top;
    const fromBottom = rect.bottom - stashDrag.y;
    let step = 0;
    if (fromTop >= 0 && fromTop < EDGE_BAND_PX) step = -Math.ceil((EDGE_BAND_PX - fromTop) / 4);
    else if (fromBottom >= 0 && fromBottom < EDGE_BAND_PX)
      step = Math.ceil((EDGE_BAND_PX - fromBottom) / 4);
    if (step === 0) continue;
    box.scrollTop += Math.max(-MAX_SCROLL_STEP_PX, Math.min(MAX_SCROLL_STEP_PX, step));
    dragMoveTo(pointedTarget(stashDrag.x, stashDrag.y));
  }
  scrollFrame = requestAnimationFrame(scrollNearEdges);
}

export function beginStashDrag(
  event: PointerEvent,
  from: TItemLocation,
  item: InventoryItem,
): void {
  if (event.button !== 0 || stashDrag.active) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const split = event.shiftKey;
  let started = false;

  const onMove = (move: PointerEvent) => {
    if (!started) {
      const far =
        Math.abs(move.clientX - startX) > DRAG_THRESHOLD_PX ||
        Math.abs(move.clientY - startY) > DRAG_THRESHOLD_PX;
      if (!far) return;
      started = true;
      dragBegin(
        from,
        item,
        {
          x: startX,
          y: startY,
          offsetX: startX - rect.left,
          offsetY: startY - rect.top,
          width: rect.width,
          height: rect.height,
        },
        split,
      );
      scrollFrame = requestAnimationFrame(scrollNearEdges);
    }
    stashDrag.x = move.clientX;
    stashDrag.y = move.clientY;
    dragMoveTo(pointedTarget(move.clientX, move.clientY));
  };
  const onUp = () => {
    const wasDragging = started;
    detach();
    if (wasDragging) dragRelease();
  };
  const onCancel = () => {
    detach();
    if (started) dragCancel();
  };
  const onKey = (key: KeyboardEvent) => {
    if (key.key === 'Escape') onCancel();
  };
  const detach = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey);
    stopListening = null;
  };

  stopListening = detach;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);
}
