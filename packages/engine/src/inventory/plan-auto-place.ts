import { exceedsCapacity, readAt, touchesStash, writeAt } from './item-queries';
import { canSplit, halfOf, placeInto } from './placement';
import type { TItemLocation } from './item-location';
import type { IInventoryAggregate, ITransferOptions, TTransferResult } from './transfer-types';

export function planItemAutoPlace(
  agg: IInventoryAggregate,
  from: TItemLocation,
  toContainer: 'bag' | 'stash',
  opts: ITransferOptions,
): TTransferResult {
  const src = readAt(agg, from);
  if (src === undefined) return { ok: false, reason: 'INVALID_LOCATION' };
  if (from.container === toContainer) return { ok: true, next: agg, kind: 'noop', moved: 0 };
  if (touchesStash(from, { container: toContainer, index: 0 }) && !opts.stashOpen) {
    return { ok: false, reason: 'STASH_LOCKED' };
  }
  if (!src) return { ok: false, reason: 'EMPTY_SOURCE' };

  if (toContainer === 'stash' && agg.stash.length === 0) {
    return { ok: false, reason: 'NO_CHEST' };
  }

  const half = opts.split && canSplit(src);
  const piece = half ? { ...src, id: opts.newId(), amount: halfOf(src) } : src;
  const placed =
    toContainer === 'bag'
      ? placeInto(agg.bag, piece)
      : placeInto(agg.stash, piece, opts.stashPreferred);
  if (!placed) return { ok: false, reason: 'CONTAINER_FULL' };

  const filled = toContainer === 'bag' ? { ...agg, bag: placed } : { ...agg, stash: placed };
  const left = src.amount - piece.amount;
  const next = writeAt(filled, from, left > 0 ? { ...src, amount: left } : null);
  if (exceedsCapacity(agg, next, opts.capacityKg)) return { ok: false, reason: 'OVERWEIGHT' };
  return { ok: true, next, kind: 'auto', moved: piece.amount };
}
