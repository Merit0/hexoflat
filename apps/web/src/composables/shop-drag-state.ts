import { reactive } from 'vue';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';
import type { TradePreview } from '@/services/trade/trade-preview';
import type { BoardCellState } from './stash-drag-state';

export type ShopDragSource =
  { kind: 'trade'; list: TTradeList; index: number } | { kind: 'bag'; index: number };

export type ShopZone = 'bag' | 'goods' | 'buyback' | 'trader';

export type ShopDropTarget = { kind: 'bag-cell'; index: number } | { kind: 'zone'; zone: ShopZone };

export type ShopDealKind = 'buy' | 'buyback' | 'sell';

export interface ShopDropPlan {
  deal: ShopDealKind;
  preview: TradePreview;
}

export interface ShopDragState {
  active: boolean;
  item: InventoryItem | null;
  source: ShopDragSource | null;
  split: boolean;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  target: ShopDropTarget | null;
  plan: ShopDropPlan | null;
  nextHint: number | null;
}

function idleDrag(): ShopDragState {
  return {
    active: false,
    item: null,
    source: null,
    split: false,
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    height: 0,
    target: null,
    plan: null,
    nextHint: null,
  };
}

export const shopDrag = reactive<ShopDragState>(idleDrag());

export function resetShopDrag(): void {
  Object.assign(shopDrag, idleDrag());
}

export function shopSourceKey(source: ShopDragSource): string {
  return source.kind === 'bag' ? `bag:${source.index}` : `${source.list}:${source.index}`;
}

export function shopTargetKey(target: ShopDropTarget | null): string {
  if (!target) return '';
  return target.kind === 'bag-cell' ? `bag:${target.index}` : `zone:${target.zone}`;
}

const IDLE_CELL: BoardCellState = { lifted: false, next: false, valid: false, invalid: false };

export function shopBagCellState(at: TItemLocation): BoardCellState {
  if (!shopDrag.active || at.container !== 'bag') return IDLE_CELL;
  const { source, target, plan, nextHint } = shopDrag;
  const isTarget = target?.kind === 'bag-cell' && target.index === at.index;
  return {
    lifted: source?.kind === 'bag' && source.index === at.index,
    next: nextHint === at.index && !isTarget,
    valid: isTarget && plan?.preview.ok === true,
    invalid: isTarget && plan?.preview.ok === false,
  };
}

export function isTradeCellLifted(list: TTradeList, index: number): boolean {
  const source = shopDrag.source;
  return (
    shopDrag.active && source?.kind === 'trade' && source.list === list && source.index === index
  );
}

export function shopZoneClass(zone: ShopZone): string {
  const target = shopDrag.target;
  if (!shopDrag.active || target?.kind !== 'zone' || target.zone !== zone || !shopDrag.plan)
    return '';
  return shopDrag.plan.preview.ok ? 'zone-ok' : 'zone-bad';
}
