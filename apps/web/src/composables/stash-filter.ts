import { categoryOf } from '@hexoflat/engine/inventory/item-transfer';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';

export const STASH_FILTERS = ['all', 'gear', 'tool', 'resource', 'consumable'] as const;
export type StashFilter = (typeof STASH_FILTERS)[number];

/** A filter only dims; an empty cell and a matching item are never dimmed. */
export function isDimmed(item: InventoryItem | null, filter: StashFilter): boolean {
  if (!item || filter === 'all') return false;
  return categoryOf(item) !== filter;
}
