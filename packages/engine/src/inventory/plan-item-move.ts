import type { InventoryItem } from '../abstraction/inventory-abstraction';
import {
  canStackTogether,
  exceedsCapacity,
  fitsEquipSlot,
  isSameLocation,
  readAt,
  stackLimit,
  touchesStash,
  writeAt,
} from './item-queries';
import { canSplit, halfOf } from './placement';
import type { TItemLocation } from './item-location';
import type {
  IInventoryAggregate,
  ITransferOptions,
  TTransferError,
  TTransferKind,
  TTransferResult,
} from './transfer-types';

type TOutcome =
  { next: IInventoryAggregate; kind: TTransferKind; moved: number } | { error: TTransferError };

interface IMove {
  agg: IInventoryAggregate;
  from: TItemLocation;
  to: TItemLocation;
  src: InventoryItem;
  dst: InventoryItem | null;
  opts: ITransferOptions;
}

function leaveBehind(
  agg: IInventoryAggregate,
  from: TItemLocation,
  src: InventoryItem,
  taken: number,
): IInventoryAggregate {
  const left = src.amount - taken;
  return writeAt(agg, from, left > 0 ? { ...src, amount: left } : null);
}

function mergeStacks({ agg, from, to, src, dst, opts }: IMove & { dst: InventoryItem }): TOutcome {
  const limit = stackLimit(dst) ?? 0;
  const room = limit - dst.amount;
  if (room <= 0) return { error: 'STACK_FULL' };
  const want = opts.split && canSplit(src) ? halfOf(src) : src.amount;
  const taken = Math.min(room, want);
  const filled = writeAt(agg, to, { ...dst, amount: dst.amount + taken });
  return { next: leaveBehind(filled, from, src, taken), kind: 'merge', moved: taken };
}

function splitOff({ agg, from, to, src, dst, opts }: IMove): TOutcome {
  if (dst) return { error: 'SPLIT_TARGET_TAKEN' };
  const half = halfOf(src);
  const placed = writeAt(agg, to, { ...src, id: opts.newId(), amount: half });
  return { next: leaveBehind(placed, from, src, half), kind: 'split', moved: half };
}

function swapPlaces({ agg, from, to, src, dst }: IMove & { dst: InventoryItem }): TOutcome {
  if (from.container === 'equip' && !fitsEquipSlot(dst, from.slot)) {
    return { error: 'SWAP_WRONG_SLOT' };
  }
  return { next: writeAt(writeAt(agg, to, src), from, dst), kind: 'swap', moved: 1 };
}

function plainMove({ agg, from, to, src }: IMove): TOutcome {
  const kind = to.container === 'equip' ? 'equip' : 'move';
  return { next: writeAt(writeAt(agg, to, src), from, null), kind, moved: src.amount };
}

function resolveMove(move: IMove): TOutcome {
  const { src, dst, to, opts } = move;
  if (dst && to.container !== 'equip' && canStackTogether(src, dst)) {
    return mergeStacks({ ...move, dst });
  }
  if (opts.split && canSplit(src)) return splitOff(move);
  if (dst) return swapPlaces({ ...move, dst });
  return plainMove(move);
}

export function planItemMove(
  agg: IInventoryAggregate,
  from: TItemLocation,
  to: TItemLocation,
  opts: ITransferOptions,
): TTransferResult {
  const src = readAt(agg, from);
  const dst = readAt(agg, to);
  if (src === undefined || dst === undefined) return { ok: false, reason: 'INVALID_LOCATION' };
  if (isSameLocation(from, to)) return { ok: true, next: agg, kind: 'noop', moved: 0 };
  if (touchesStash(from, to) && !opts.stashOpen) return { ok: false, reason: 'STASH_LOCKED' };
  if (!src) return { ok: false, reason: 'EMPTY_SOURCE' };
  if (to.container === 'equip' && !fitsEquipSlot(src, to.slot)) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }

  const outcome = resolveMove({ agg, from, to, src, dst, opts });
  if ('error' in outcome) return { ok: false, reason: outcome.error };
  if (exceedsCapacity(agg, outcome.next, opts.capacityKg)) {
    return { ok: false, reason: 'OVERWEIGHT' };
  }
  return { ok: true, ...outcome };
}
