import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { canStackTogether, stackLimit } from './item-queries';
import type { TItemCells } from './transfer-types';

/**
 * Puts a piece into a container: first tops up unfinished stacks of the same kind (in index
 * order), then takes the first empty cell. All or nothing: `null` when it does not fit.
 */
export function placeInto(cells: TItemCells, piece: InventoryItem): TItemCells | null {
  const next = cells.slice();
  const limit = stackLimit(piece);
  let remaining = piece.amount;

  if (limit !== null) {
    for (let index = 0; index < next.length && remaining > 0; index += 1) {
      const cell = next[index];
      if (!cell || !canStackTogether(cell, piece) || cell.amount >= limit) continue;
      const add = Math.min(limit - cell.amount, remaining);
      next[index] = { ...cell, amount: cell.amount + add };
      remaining -= add;
    }
  }

  if (remaining <= 0) return next;
  const free = next.findIndex((cell) => cell === null);
  if (free === -1) return null;
  next[free] = { ...piece, amount: remaining };
  return next;
}

export function halfOf(item: InventoryItem): number {
  return Math.floor(item.amount / 2);
}

export function canSplit(item: InventoryItem): boolean {
  return item.amount > 1 && stackLimit(item) !== null;
}
