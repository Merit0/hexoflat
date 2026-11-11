import { computed } from 'vue';
import { getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { TRADERS } from '@hexoflat/engine/content/traders.content';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import { walletCoins } from '@hexoflat/engine/trade/trader-view';
import type { BuybackEntry, TraderGood } from '@hexoflat/engine/trade/trade-state';
import type { ITraderRef, TTradeList } from '@hexoflat/engine/trade/trade-types';
import { currentInventory } from '@/services/trade/trade-commands';
import {
  previewBuy,
  previewRefresh,
  previewSell,
  type TradePreview,
} from '@/services/trade/trade-preview';
import { useHeroStore } from '@/stores/hero-store';
import { useTraderStore } from '@/stores/trader-store';
import type { TooltipPrice } from './use-item-tooltip';

export interface ShopTradeCell {
  index: number;
  item: InventoryItem | null;
  price: number | null;
  affordable: boolean;
  sold: boolean;
}

export function tradeItemOf(
  list: TTradeList,
  index: number,
  entry: TraderGood | BuybackEntry,
): InventoryItem {
  return {
    id: `shop-${list}-${index}`,
    key: entry.key,
    type: getPrototype(entry.key).groupType,
    amount: entry.amount,
    slotKey: '',
    isNew: false,
  };
}

function pricedCell(index: number, item: InventoryItem | null, preview: TradePreview | null) {
  const price = preview?.price ?? null;
  const affordable = !preview || preview.ok || preview.reason !== 'NOT_ENOUGH_COINS';
  return { index, item, price, affordable, sold: false };
}

export function useShopBoardData() {
  const traderStore = useTraderStore();
  const heroStore = useHeroStore();

  const definition = computed(() =>
    traderStore.traderKey ? TRADERS[traderStore.traderKey] : null,
  );
  const trader = computed<ITraderRef | null>(() =>
    traderStore.traderKey && traderStore.view
      ? { key: traderStore.traderKey, state: traderStore.view }
      : null,
  );
  const inventory = computed(() => currentInventory());

  function cellsOf(list: TTradeList): ShopTradeCell[] {
    const ref = trader.value;
    if (!ref) return [];
    return ref.state[list].map((entry, index) => {
      if (!entry) return pricedCell(index, null, null);
      if ('sold' in entry && entry.sold) {
        return { ...pricedCell(index, tradeItemOf(list, index, entry), null), sold: true };
      }
      const preview = previewBuy(inventory.value, ref, { list, index }, 'auto', false);
      return pricedCell(index, tradeItemOf(list, index, entry), preview);
    });
  }

  const goods = computed(() => cellsOf('goods'));
  const buyback = computed(() => cellsOf('buyback'));

  const will = computed(() => heroStore.knowledge?.current ?? 0);

  const refresh = computed(() => {
    const ref = trader.value;
    if (!ref) return null;
    return previewRefresh(ref.key, ref.state, traderStore.trips, will.value);
  });

  function sellPriceOf(location: TItemLocation): TooltipPrice | null {
    const ref = trader.value;
    if (!ref || location.container !== 'bag') return null;
    const preview = previewSell(inventory.value, ref, location.index, false);
    return preview.price === null ? null : { kind: 'sell', coins: preview.price, affordable: true };
  }

  return {
    definition,
    coins: computed(() => walletCoins(inventory.value)),
    sellRatePercent: computed(() =>
      definition.value
        ? Math.round((definition.value.sellRate.num * 100) / definition.value.sellRate.den)
        : 0,
    ),
    goods,
    buyback,
    will,
    refresh,
    sellPriceOf,
  };
}
