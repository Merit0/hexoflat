import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { canStackTogether, categoryOf, compareItemsForSort, stackLimit } from './item-queries';
import { placeInto } from './placement';
import type { IInventoryAggregate, IStashActionOptions, TTransferResult } from './transfer-types';

export function planStoreResources(
  agg: IInventoryAggregate,
  opts: IStashActionOptions,
): TTransferResult {
  if (!opts.stashOpen) return { ok: false, reason: 'STASH_LOCKED' };
  const bag = agg.bag.slice();
  let stash = agg.stash;
  let candidates = 0;
  let stored = 0;

  bag.forEach((item, index) => {
    if (!item) return;
    const category = categoryOf(item);
    if (category !== 'resource' && category !== 'consumable') return;
    candidates += 1;
    const placed = placeInto(stash, item);
    if (!placed) return;
    stash = placed;
    bag[index] = null;
    stored += 1;
  });

  if (candidates === 0) return { ok: true, next: agg, kind: 'noop', moved: 0 };
  if (agg.stash.length === 0) return { ok: false, reason: 'NO_CHEST' };
  if (stored === 0) return { ok: false, reason: 'CONTAINER_FULL' };
  return { ok: true, next: { ...agg, bag, stash }, kind: 'store', moved: stored };
}

function mergeStacks(items: InventoryItem[]): InventoryItem[] {
  const merged: InventoryItem[] = [];
  for (const item of items) {
    let remaining = item.amount;
    for (let index = 0; index < merged.length && remaining > 0; index += 1) {
      const target = merged[index];
      const limit = stackLimit(target);
      if (limit === null || !canStackTogether(target, item) || target.amount >= limit) continue;
      const add = Math.min(limit - target.amount, remaining);
      merged[index] = { ...target, amount: target.amount + add };
      remaining -= add;
    }
    if (remaining > 0) merged.push({ ...item, amount: remaining });
  }
  return merged;
}

function sameCells(a: (InventoryItem | null)[], b: (InventoryItem | null)[]): boolean {
  return a.every((cell, index) => cell?.id === b[index]?.id && cell?.amount === b[index]?.amount);
}

/** Merges unfinished stacks, then orders by category, rarity and key (never by translated text). */
export function planSortStash(
  agg: IInventoryAggregate,
  opts: IStashActionOptions,
): TTransferResult {
  if (!opts.stashOpen) return { ok: false, reason: 'STASH_LOCKED' };
  const items = agg.stash.flatMap((cell) => (cell ? [cell] : []));
  const ordered = mergeStacks(items).sort(compareItemsForSort);
  const stash = Array.from({ length: agg.stash.length }, (_, index) => ordered[index] ?? null);
  if (sameCells(stash, agg.stash)) return { ok: true, next: agg, kind: 'noop', moved: 0 };
  return { ok: true, next: { ...agg, stash }, kind: 'sort', moved: items.length - ordered.length };
}
