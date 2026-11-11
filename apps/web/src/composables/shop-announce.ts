import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { currentInventory, traderRef } from '@/services/trade/trade-commands';
import { useTraderStore } from '@/stores/trader-store';
import type { ShopDragSource } from './shop-drag-state';

export function readSourceItemKey(source: ShopDragSource): THexobjectKey | null {
  if (source.kind === 'bag') return currentInventory().bag[source.index]?.key ?? null;
  const key = useTraderStore().traderKey;
  const ref = key ? traderRef(key) : null;
  return ref?.state[source.list][source.index]?.key ?? null;
}
