import { computed } from 'vue';
import { getMeta } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { getItemUnitWeightKg } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { i18n } from '@/i18n';
import { currentInventory, traderRef } from '@/services/trade/trade-commands';
import { previewBuy, previewSell, type TradePreview } from '@/services/trade/trade-preview';
import { useTraderStore } from '@/stores/trader-store';
import { shopQty, shopSelection } from './shop-selection';
import type { ShopDragSource } from './shop-drag-state';

export type ShopCardMode = 'buying' | 'buyback' | 'trading';
export type ShopBlock = 'OVERWEIGHT' | 'BAG_FULL' | 'NOT_SELLABLE' | null;

export interface ShopCardView {
  mode: ShopCardMode;
  key: THexobjectKey;
  name: string;
  available: number;
  unitWeightKg: number;
  inBag: number;
  source: ShopDragSource;
  preview: TradePreview;
  block: ShopBlock;
  maxQty: number;
}

function blockOf(preview: TradePreview): ShopBlock {
  if (preview.ok) return null;
  if (preview.reason === 'OVERWEIGHT') return 'OVERWEIGHT';
  if (preview.reason === 'CONTAINER_FULL') return 'BAG_FULL';
  if (preview.reason === 'NOT_TRADEABLE') return 'NOT_SELLABLE';
  return null;
}

function nameOf(key: THexobjectKey): string {
  const title = getMeta(key).title;
  return i18n.global.te(title) ? i18n.global.t(title) : title;
}

function targetOf(
  source: ShopDragSource,
  available: number,
  run: (amount: number) => TradePreview,
): number {
  for (let amount = available; amount > 1; amount -= 1) {
    if (run(amount).ok) return amount;
  }
  return 1;
}

function locate(): { source: ShopDragSource; key: THexobjectKey; available: number } | null {
  const list = shopSelection.list;
  if (!list) return null;
  const inventory = currentInventory();
  if (list === 'bag') {
    const item = inventory.bag[shopSelection.index] ?? null;
    if (!item || item.key !== shopSelection.key) return null;
    return {
      source: { kind: 'bag', index: shopSelection.index },
      key: item.key,
      available: item.amount,
    };
  }
  const traderKey = useTraderStore().traderKey;
  const ref = traderKey ? traderRef(traderKey) : null;
  const entry = ref?.state[list][shopSelection.index];
  if (!entry || entry.key !== shopSelection.key || ('sold' in entry && entry.sold)) return null;
  return {
    source: { kind: 'trade', list, index: shopSelection.index },
    key: entry.key,
    available: entry.amount,
  };
}

export function useShopCard() {
  return computed<ShopCardView | null>(() => {
    const found = locate();
    const key = useTraderStore().traderKey;
    const ref = key ? traderRef(key) : null;
    if (!found || !ref) return null;
    const inventory = currentInventory();
    const { source, available } = found;
    const price = (amount: number): TradePreview =>
      source.kind === 'bag'
        ? previewSell(inventory, ref, source.index, false, amount)
        : previewBuy(
            inventory,
            ref,
            { list: source.list, index: source.index },
            'auto',
            false,
            amount,
          );
    const qty = Math.min(Math.max(shopQty.value, 1), available);
    const preview = price(qty);
    return {
      mode: source.kind === 'bag' ? 'trading' : source.list === 'goods' ? 'buying' : 'buyback',
      key: found.key,
      name: nameOf(found.key),
      available,
      unitWeightKg: getItemUnitWeightKg(found.key),
      inBag: inventory.bag.reduce(
        (sum, cell) => (cell && cell.key === found.key ? sum + cell.amount : sum),
        0,
      ),
      source,
      preview,
      block: blockOf(preview),
      maxQty: source.kind === 'bag' ? available : targetOf(source, available, price),
    };
  });
}
