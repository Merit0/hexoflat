import { afterEach, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Presence } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import type { BuybackEntry, TraderGood } from '@hexoflat/engine/trade/trade-state';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { i18n } from '@/i18n';
import { hideItemTooltip } from '@/composables/use-item-tooltip';
import { resetShopDrag } from '@/composables/shop-drag-state';
import { clearShopSelection } from '@/composables/shop-selection';
import { shopTab } from '@/composables/shop-tab';
import { clearShopToast } from '@/composables/shop-toast';
import { settleShopDeal } from '@/composables/use-shop-drag';
import {
  applyProgress,
  bindKnowledgeListener,
  settleInventorySync,
} from '@/services/inventory/inventory-sync';
import { inventorySession } from '@/services/inventory/inventory-session';
import { currentInventory } from '@/services/trade/trade-commands';
import { traderProjection } from '@/services/trade/trader-projection';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { sentCommands } from '@/test-support/fake-player-server';
import { seedFakeSession } from '@/test-support/fake-session';
import { fakeTraderFixture } from '@/test-support/fake-trader-fixture';
import ShopBoard from './shop-board.vue';

export const HERO = 'hero-shop';
export const [STALL] = campObjectSpots(K.TRADER_STALL);
export const AT_STALL: Presence = {
  locationKey: 'camping',
  mapId: 'camping-1',
  coordinates: getHexNeighbors(STALL)[0],
};
export const POTION_PRICE = coinPriceOf(K.HEALTH_BOTTLE)!;
export const SWORD_PRICE = coinPriceOf(K.SWORD)!;

export const view = {
  app: null as App | null,
  host: null as HTMLElement | null,
  pointed: [] as Element[],
};

export const byId = (id: string) => view.host!.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
export const ghostBadge = () =>
  document.querySelector<HTMLElement>('[data-testid="shop-drag-badge"]');
export const coins = () => useHeroInventoryStore().countItem(K.COINS);
export const ilva = () => traderProjection.value.traders.ilva!;
export const bagKeys = () =>
  currentInventory().bag.map((cell) => cell && `${cell.key}x${cell.amount}`);
export const message = () => useHeroToolStore().actionMessage;
export const shopCommands = () =>
  sentCommands.filter((sent) => sent.command.type.startsWith('SHOP_')).map((s) => s.command.type);

export function pointer(type: string, init: MouseEventInit) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
}

export function bagCell(index: number): HTMLElement {
  return view.host!.querySelector<HTMLElement>(
    `[data-drop-container="bag"][data-drop-index="${index}"]`,
  )!;
}

export function bagCellWith(key: string): HTMLElement {
  return view.host!.querySelector<HTMLElement>(
    `[data-drop-container="bag"][data-item-key="${key}"]`,
  )!;
}

export async function mountShop(
  options: {
    coins?: number;
    will?: number;
    goods?: (TraderGood | null)[];
    buyback?: (BuybackEntry | null)[];
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  resetShopDrag();
  clearShopSelection();
  clearShopToast();
  shopTab.value = 'goods';
  sentCommands.length = 0;
  seedFakeSession(HERO, { presence: AT_STALL, will: options.will ?? 50 });
  useHeroToolStore().clearActionMessage();
  const inventory = useHeroInventoryStore();
  inventory.carryCapacityKg = 50;
  if (options.coins) inventory.putToInventory(K.COINS, options.coins);
  await settleInventorySync();
  const hero = useHeroStore();
  hero.knowledge = inventorySession.knowledge;
  bindKnowledgeListener((knowledge) => (hero.knowledge = knowledge));
  const fixture = {
    trader: 'ilva',
    goods: options.goods ?? [
      { key: K.HEALTH_BOTTLE, amount: 4 },
      { key: K.SWORD, amount: 1 },
    ],
    buyback: options.buyback ?? [],
  };
  applyProgress(fakeTraderFixture(fixture).aggregates.progress);
  useTraderStore().open('ilva');
  sentCommands.length = 0;
  view.host = document.createElement('div');
  document.body.appendChild(view.host);
  view.app = createApp(ShopBoard).use(pinia).use(i18n);
  view.app.mount(view.host);
  await nextTick();
  (document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () =>
    view.pointed;
}

export async function drag(from: HTMLElement, over: Element[], options: { shift?: boolean } = {}) {
  from.dispatchEvent(
    pointer('pointerdown', { button: 0, clientX: 10, clientY: 10, shiftKey: !!options.shift }),
  );
  view.pointed = over;
  window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
  await nextTick();
}

export async function drop() {
  window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
  await settleShopDeal();
  await nextTick();
}

export function registerShopCleanup(): void {
  afterEach(() => {
    bindKnowledgeListener(null);
    clearShopToast();
    hideItemTooltip();
    view.app?.unmount();
    view.app = null;
    view.host?.remove();
    view.pointed = [];
    vi.useRealTimers();
  });
}

export async function openBuybackTab(): Promise<void> {
  byId('shop-tab-buyback').click();
  await nextTick();
}
