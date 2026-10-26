import { computed, shallowRef, watch } from 'vue';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import {
  resolveItemTooltip,
  type ItemTooltipView,
} from '@hexoflat/engine/utils/inventory/item-tooltip';
import type { SkillRanks } from '@hexoflat/engine/skills/skill-rules';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { inventoryDragState } from '@/composables/use-inventory-drag';

const SHOW_DELAY_MS = 120;
const SIDE_GAP_PX = 16;
const EDGE_MARGIN_PX = 24;

export interface TooltipTarget {
  itemId: string;
  rect: DOMRect;
}

export interface TooltipSize {
  width: number;
  height: number;
}

export interface TooltipViewport {
  width: number;
  height: number;
}

const target = shallowRef<TooltipTarget | null>(null);
let showTimer: number | null = null;

function clearShowTimer() {
  if (showTimer !== null) window.clearTimeout(showTimer);
  showTimer = null;
}

export function computeTooltipPosition(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'height'>,
  size: TooltipSize,
  viewport: TooltipViewport,
): { left: number; top: number } {
  const fitsRight = rect.right + SIDE_GAP_PX + size.width <= viewport.width - EDGE_MARGIN_PX;
  const left = fitsRight
    ? rect.right + SIDE_GAP_PX
    : Math.max(EDGE_MARGIN_PX, rect.left - SIDE_GAP_PX - size.width);
  const centered = rect.top + rect.height / 2 - size.height / 2;
  const maxTop = Math.max(EDGE_MARGIN_PX, viewport.height - EDGE_MARGIN_PX - size.height);
  const top = Math.min(Math.max(centered, EDGE_MARGIN_PX), maxTop);
  return { left, top };
}

export function hideItemTooltip() {
  clearShowTimer();
  target.value = null;
}

function isTooltipSuppressed(): boolean {
  return inventoryDragState.isDragging || useHeroInventoryStore().selectedItemId !== null;
}

export function showItemTooltip(itemId: string, element: HTMLElement) {
  clearShowTimer();
  if (isTooltipSuppressed()) return;
  showTimer = window.setTimeout(() => {
    showTimer = null;
    if (isTooltipSuppressed()) return;
    target.value = { itemId, rect: element.getBoundingClientRect() };
  }, SHOW_DELAY_MS);
}

export function resolveInventoryItemTooltip(
  inventory: ReturnType<typeof useHeroInventoryStore>,
  item: InventoryItem,
  skills?: SkillRanks,
): ItemTooltipView {
  const equippedItems = inventory.equippedItems;
  const equipSlot = resolveInventoryView(item.key).equipSlot;
  const equipped = Object.values(equippedItems).some((entry) => entry?.id === item.id);
  const compareWith = !equipped && equipSlot ? equippedItems[equipSlot]?.key : undefined;
  return resolveItemTooltip(item.key, { equipped, compareWith, amount: item.amount, skills });
}

export function useItemTooltip() {
  const inventory = useHeroInventoryStore();
  const heroStore = useHeroStore();

  const view = computed<ItemTooltipView | null>(() => {
    if (!target.value) return null;
    const item = inventory.items.find((entry) => entry.id === target.value?.itemId);
    return item ? resolveInventoryItemTooltip(inventory, item, heroStore.knowledge?.skills) : null;
  });

  watch(
    () => inventoryDragState.isDragging,
    (dragging) => {
      if (dragging) hideItemTooltip();
    },
  );

  return { target, view };
}
