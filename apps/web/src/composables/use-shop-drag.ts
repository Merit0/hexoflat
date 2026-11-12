import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { ITraderRef, TBuyTarget } from '@hexoflat/engine/trade/trade-types';
import {
  buyFromTrader,
  currentInventory,
  sellToTrader,
  traderRef,
  type TradeOutcome,
} from '@/services/trade/trade-commands';
import {
  previewBuy,
  previewBuyLanding,
  previewSell,
  type TradePreview,
} from '@/services/trade/trade-preview';
import { useTraderStore } from '@/stores/trader-store';
import { hideItemTooltip } from './use-item-tooltip';
import {
  flashFor,
  setGrabbing,
  startEdgeScroll,
  trackPointerDrag,
  type DragPoint,
} from './board-drag-core';
import { stashFx } from './stash-drag-state';
import { blinkWeight } from './use-stash-drag';
import { buyTargetOf, planShopDrop, resolveShopTarget } from './shop-drop';
import {
  resetShopDrag,
  shopDrag,
  shopSourceKey,
  shopTargetKey,
  type ShopDragSource,
  type ShopDropTarget,
} from './shop-drag-state';
import { announceDeal, warnTrade } from './shop-messages';
import { readSourceItemKey } from './shop-announce';

let targetKey = '';
let stopScroll: (() => void) | null = null;
let stopListening: (() => void) | null = null;
let pending: Promise<void> | null = null;

function activeTrader(): ITraderRef | null {
  const key = useTraderStore().traderKey;
  return key ? traderRef(key) : null;
}

export function settleShopDeal(): Promise<void> {
  return pending ?? Promise.resolve();
}

export function shopDragBegin(
  source: ShopDragSource,
  item: InventoryItem,
  point: DragPoint,
  split: boolean,
): void {
  hideItemTooltip();
  targetKey = '';
  const trader = activeTrader();
  const nextHint =
    trader && source.kind === 'trade'
      ? previewBuyLanding(
          currentInventory(),
          trader,
          { list: source.list, index: source.index },
          split,
        )
      : null;
  Object.assign(shopDrag, {
    active: true,
    item,
    source,
    split,
    ...point,
    target: null,
    plan: null,
    nextHint,
  });
  setGrabbing(true);
}

export function shopDragMoveTo(target: ShopDropTarget | null): void {
  const key = shopTargetKey(target);
  if (key === targetKey || !shopDrag.source) return;
  targetKey = key;
  shopDrag.target = target;
  const trader = activeTrader();
  shopDrag.plan =
    target && trader
      ? planShopDrop(currentInventory(), trader, shopDrag.source, target, shopDrag.split)
      : null;
}

export function shopDragCancel(): void {
  stopScroll?.();
  stopScroll = null;
  stopListening?.();
  stopListening = null;
  targetKey = '';
  setGrabbing(false);
  resetShopDrag();
}

function refuse(reason: string, price: number | null, home: string): void {
  warnTrade(reason, price);
  flashFor(stashFx, 'shake', home);
  if (reason === 'OVERWEIGHT') blinkWeight();
}

function undoSale(key: THexobjectKey, amount: number): void {
  const trader = activeTrader();
  const index = trader?.state.buyback.findIndex((entry) => entry?.key === key) ?? -1;
  if (index < 0) return;
  void quickTrade({ kind: 'trade', list: 'buyback', index }, false, amount);
}

function send(
  source: ShopDragSource,
  to: TBuyTarget,
  split: boolean,
  amount?: number,
): Promise<TradeOutcome> {
  const key = useTraderStore().traderKey;
  if (!key) return Promise.resolve({ ok: false, reason: 'NOT_AT_TRADER', price: null });
  return source.kind === 'trade'
    ? buyFromTrader(key, { list: source.list, index: source.index }, to, split, amount)
    : sellToTrader(key, source.index, split, amount);
}

function deal(
  source: ShopDragSource,
  to: TBuyTarget,
  split: boolean,
  preview: TradePreview,
  home: string,
  amount?: number,
): Promise<void> {
  if (!preview.ok) {
    refuse(preview.reason, preview.price, home);
    return Promise.resolve();
  }
  const key = readSourceItemKey(source);
  const run = send(source, to, split, amount).then((outcome) => {
    if (!outcome.ok) refuse(outcome.reason, outcome.price, home);
    else {
      if (to !== 'auto') flashFor(stashFx, 'landed', `bag:${to.index}`);
      if (key) announceDeal(source, key, preview, undoSale);
    }
  });
  pending = run.finally(() => {
    pending = null;
  });
  return pending;
}

export function shopDragRelease(): Promise<void> {
  const { source, target, plan, split } = shopDrag;
  shopDragCancel();
  if (!source || !target || !plan || pending) return Promise.resolve();
  const home = target.kind === 'bag-cell' ? `bag:${target.index}` : shopSourceKey(source);
  const to = source.kind === 'trade' ? buyTargetOf(target) : 'auto';
  return to ? deal(source, to, split, plan.preview, home) : Promise.resolve();
}

function quickPreview(
  trader: ITraderRef,
  source: ShopDragSource,
  split: boolean,
  amount?: number,
): TradePreview {
  const inventory = currentInventory();
  return source.kind === 'trade'
    ? previewBuy(
        inventory,
        trader,
        { list: source.list, index: source.index },
        'auto',
        split,
        amount,
      )
    : previewSell(inventory, trader, source.index, split, amount);
}

export function quickTrade(source: ShopDragSource, split = false, amount?: number): Promise<void> {
  const trader = activeTrader();
  if (!trader || pending) return Promise.resolve();
  return deal(
    source,
    'auto',
    split,
    quickPreview(trader, source, split, amount),
    shopSourceKey(source),
    amount,
  );
}

function pointedTarget(x: number, y: number): ShopDropTarget | null {
  return resolveShopTarget(document.elementsFromPoint(x, y));
}

function draggedPointer(): { x: number; y: number } | null {
  return shopDrag.active ? { x: shopDrag.x, y: shopDrag.y } : null;
}

export function beginShopDrag(
  event: PointerEvent,
  source: ShopDragSource,
  item: InventoryItem,
): void {
  if (event.button !== 0 || shopDrag.active || pending) return;
  const split = event.shiftKey;
  stopListening = trackPointerDrag(event, {
    start: (point) => {
      shopDragBegin(source, item, point, split);
      stopScroll = startEdgeScroll(draggedPointer, () =>
        shopDragMoveTo(pointedTarget(shopDrag.x, shopDrag.y)),
      );
    },
    move: (x, y) => {
      shopDrag.x = x;
      shopDrag.y = y;
      shopDragMoveTo(pointedTarget(x, y));
    },
    release: () => void shopDragRelease(),
    cancel: shopDragCancel,
  });
}
