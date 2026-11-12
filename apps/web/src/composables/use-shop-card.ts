import { computed } from 'vue';
import { getMeta } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { getItemUnitWeightKg } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { i18n } from '@/i18n';
import { currentInventory, traderRef } from '@/services/trade/trade-commands';
import { planList, planUnlist } from '@hexoflat/engine/trade/plan-listing';
import { previewBuy, previewSell, type TradePreview } from '@/services/trade/trade-preview';
import { traderProjection } from '@/services/trade/trader-projection';
import { shopTab } from './shop-tab';
import { useTraderStore } from '@/stores/trader-store';
import { shopListPrice, shopQty, shopSelection } from './shop-selection';
import type { ShopDragSource } from './shop-drag-state';

export type ShopCardMode = 'buying' | 'buyback' | 'trading' | 'listing' | 'listed';
export type ShopBlock = 'OVERWEIGHT' | 'BAG_FULL' | 'NOT_SELLABLE' | 'SLOTS_FULL' | null;

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
  discountPercent: number | null;
  ownSlot: number | null;
  ownUnitPrice: number | null;
  listPrice: number | null;
}

export function parseListPrice(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const price = Number(raw);
  return price >= 1 ? price : null;
}

function blockOf(preview: TradePreview): ShopBlock {
  if (preview.ok) return null;
  if (preview.reason === 'OVERWEIGHT') return 'OVERWEIGHT';
  if (preview.reason === 'CONTAINER_FULL') return 'BAG_FULL';
  if (preview.reason === 'NOT_TRADEABLE') return 'NOT_SELLABLE';
  if (preview.reason === 'TRADE_SLOTS_FULL') return 'SLOTS_FULL';
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

interface Located {
  ownSlot: number | null;
  source: ShopDragSource;
  key: THexobjectKey;
  available: number;
  discountPercent: number | null;
}

function locate(): Located | null {
  const list = shopSelection.list;
  if (!list) return null;
  const inventory = currentInventory();
  if (list === 'own') {
    const listing = traderProjection.value.listings[shopSelection.index] ?? null;
    if (!listing || listing.key !== shopSelection.key) return null;
    return {
      ownSlot: shopSelection.index,
      source: { kind: 'trade', list: 'goods', index: shopSelection.index },
      key: listing.key,
      available: listing.amount,
      discountPercent: null,
    };
  }
  if (list === 'bag') {
    const item = inventory.bag[shopSelection.index] ?? null;
    if (!item || item.key !== shopSelection.key) return null;
    return {
      ownSlot: null,
      source: { kind: 'bag', index: shopSelection.index },
      key: item.key,
      available: item.amount,
      discountPercent: null,
    };
  }
  const traderKey = useTraderStore().traderKey;
  const ref = traderKey ? traderRef(traderKey) : null;
  const entry = ref?.state[list][shopSelection.index];
  if (!entry || entry.key !== shopSelection.key) return null;
  if ('sold' in entry && (entry.sold || entry.wasted)) return null;
  return {
    ownSlot: null,
    source: { kind: 'trade', list, index: shopSelection.index },
    key: entry.key,
    available: entry.amount,
    discountPercent: 'discountPercent' in entry ? (entry.discountPercent ?? null) : null,
  };
}

function listingPreview(
  found: Located,
  qty: number,
  listPrice: number | null,
): { mode: ShopCardMode; preview: TradePreview } {
  const inventory = currentInventory();
  const listings = traderProjection.value.listings;
  if (found.ownSlot !== null) {
    const result = planUnlist(inventory, listings, found.ownSlot);
    const price = listings[found.ownSlot]?.unitPrice ?? 0;
    return {
      mode: 'listed',
      preview: result.ok
        ? { ok: true, price, amount: result.amount }
        : { ok: false, reason: result.reason, price: null },
    };
  }
  const index = found.source.kind === 'bag' ? found.source.index : 0;
  const result = planList(inventory, listings, index, listPrice ?? 1, qty);
  return {
    mode: 'listing',
    preview: result.ok
      ? { ok: true, price: result.unitPrice, amount: result.amount }
      : { ok: false, reason: result.reason, price: null },
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
    const listPrice = parseListPrice(shopListPrice.value);
    const ownMode = found.ownSlot !== null || (source.kind === 'bag' && shopTab.value === 'trade');
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
    const qty =
      found.discountPercent !== null || found.ownSlot !== null
        ? found.ownSlot !== null
          ? available
          : 1
        : Math.min(Math.max(shopQty.value, 1), available);
    const listed = ownMode ? listingPreview(found, qty, listPrice) : null;
    const preview = listed ? listed.preview : price(qty);
    const defaultMode: ShopCardMode =
      source.kind === 'bag' ? 'trading' : source.list === 'goods' ? 'buying' : 'buyback';
    return {
      mode: listed ? listed.mode : defaultMode,
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
      maxQty:
        found.ownSlot !== null
          ? available
          : found.discountPercent !== null
            ? 1
            : source.kind === 'bag'
              ? available
              : targetOf(source, available, price),
      discountPercent: found.discountPercent,
      ownSlot: found.ownSlot,
      ownUnitPrice:
        found.ownSlot !== null
          ? (traderProjection.value.listings[found.ownSlot]?.unitPrice ?? null)
          : null,
      listPrice,
    };
  });
}
