import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { ITraderRef, TBuyTarget } from '@hexoflat/engine/trade/trade-types';
import { previewBuy, previewSell } from '@/services/trade/trade-preview';
import type { ShopDragSource, ShopDropPlan, ShopDropTarget, ShopZone } from './shop-drag-state';

const ZONES: readonly ShopZone[] = ['bag', 'goods', 'buyback', 'trader'];
const SELL_ZONES: ReadonlySet<ShopZone> = new Set(['goods', 'buyback', 'trader']);

export function resolveShopTarget(elements: Element[]): ShopDropTarget | null {
  const html = elements.filter((element): element is HTMLElement => element instanceof HTMLElement);
  const cell = html.find((element) => element.dataset.dropContainer === 'bag');
  if (cell) {
    const index = Number(cell.dataset.dropIndex);
    if (Number.isInteger(index)) return { kind: 'bag-cell', index };
  }
  const zone = html.find((element) => element.dataset.zone !== undefined)?.dataset.zone;
  const known = ZONES.find((candidate) => candidate === zone);
  return known ? { kind: 'zone', zone: known } : null;
}

export function buyTargetOf(target: ShopDropTarget): TBuyTarget | null {
  if (target.kind === 'bag-cell') return { container: 'bag', index: target.index };
  return target.zone === 'bag' ? 'auto' : null;
}

export function planShopDrop(
  inventory: InventoryState,
  trader: ITraderRef,
  source: ShopDragSource,
  target: ShopDropTarget,
  split: boolean,
): ShopDropPlan | null {
  if (source.kind === 'trade') {
    const to = buyTargetOf(target);
    if (!to) return null;
    const from = { list: source.list, index: source.index };
    const deal = source.list === 'buyback' ? 'buyback' : 'buy';
    return { deal, preview: previewBuy(inventory, trader, from, to, split) };
  }
  if (target.kind !== 'zone' || !SELL_ZONES.has(target.zone)) return null;
  return { deal: 'sell', preview: previewSell(inventory, trader, source.index, split) };
}

export type ShopDropLabelId =
  'buy' | 'buySplit' | 'sell' | 'buyback' | 'cantAfford' | 'notInterested' | 'cant';

export interface ShopDropLabel {
  id: ShopDropLabelId;
  tone: 'ok' | 'bad';
  count: number;
  price: number;
}

export function describeShopDrop(plan: ShopDropPlan | null): ShopDropLabel | null {
  if (!plan) return null;
  const { preview } = plan;
  if (!preview.ok) {
    const id =
      preview.reason === 'NOT_ENOUGH_COINS'
        ? 'cantAfford'
        : preview.reason === 'NOT_TRADEABLE'
          ? 'notInterested'
          : 'cant';
    return { id, tone: 'bad', count: 0, price: preview.price ?? 0 };
  }
  const { amount, price } = preview;
  if (plan.deal === 'sell') return { id: 'sell', tone: 'ok', count: amount, price };
  if (plan.deal === 'buyback') return { id: 'buyback', tone: 'ok', count: amount, price };
  return { id: amount > 1 ? 'buySplit' : 'buy', tone: 'ok', count: amount, price };
}
