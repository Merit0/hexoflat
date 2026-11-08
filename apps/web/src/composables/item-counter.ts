import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';

export function showsCounter(item: Pick<InventoryItem, 'key'> | null | undefined): boolean {
  return !!item && resolveInventoryView(item.key).stackable;
}
