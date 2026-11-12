import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
import { TRADERS } from '@hexoflat/engine/content/traders.content';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';
import { sellUnitPrice } from '@hexoflat/engine/trade/trader-view';
import { shopTab } from '@/composables/shop-tab';
import { hideItemTooltip, useItemTooltip } from '@/composables/use-item-tooltip';
import { applyTraderProjection, resetTraderProjection } from '@/services/trade/trader-projection';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useTraderStore } from '@/stores/trader-store';
import { beginStashDrag, quickMove } from '@/composables/use-stash-drag';
import ShopBoard from './shop-board.vue';

vi.mock('@/composables/use-stash-drag', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/composables/use-stash-drag')>()),
  quickMove: vi.fn(),
  beginStashDrag: vi.fn(),
}));

const EMPTY_ROW = Array.from({ length: 8 }, () => null);

function trader(overrides: Partial<TraderState> = {}): TraderState {
  return {
    serial: 0,
    trip: 0,
    paidRefreshes: 0,
    goods: [{ key: K.HEALTH_BOTTLE, amount: 3 }, { key: K.SWORD, amount: 1 }, ...EMPTY_ROW].slice(
      0,
      8,
    ),
    buyback: EMPTY_ROW.slice(0, 7),
    ...overrides,
  };
}

let app: App | null = null;
let host: HTMLElement;

async function mountShop(options: { coins?: number; will?: number; state?: TraderState } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  shopTab.value = 'goods';
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 10;
  if (options.coins) inventory.putToInventory(K.COINS, options.coins);
  useHeroStore().knowledge = { current: options.will ?? 50 } as KnowledgeState;
  applyTraderProjection({ traders: { ilva: options.state ?? trader() }, trips: 0 });
  useTraderStore().open('ilva');
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(ShopBoard).use(pinia).use(i18n);
  app.mount(host);
  await nextTick();
}

const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const all = (prefix: string) => host.querySelectorAll<HTMLElement>(`[data-testid^="${prefix}"]`);
const follows = (first: string, second: string) =>
  !!(byId(first)!.compareDocumentPosition(byId(second)!) & Node.DOCUMENT_POSITION_FOLLOWING);

afterEach(() => {
  hideItemTooltip();
  app?.unmount();
  app = null;
  host?.remove();
  resetTraderProjection();
  vi.useRealTimers();
});

describe('shop board layout', () => {
  beforeEach(() => mountShop({ coins: 100 }));

  it('stacks the header, trader, goods, card and bag in that order', () => {
    expect(byId('shop-board')).not.toBeNull();
    expect(follows('shop-close', 'shop-trader-banner')).toBe(true);
    expect(follows('shop-trader-banner', 'shop-goods-pane')).toBe(true);
    expect(follows('shop-goods-pane', 'shop-card')).toBe(true);
    expect(follows('shop-card', 'stash-bag-pane')).toBe(true);
  });

  it('shows eight goods cells with the item and its stack price', () => {
    expect(all('shop-goods-cell-')).toHaveLength(8);
    const potion = byId('shop-goods-cell-0')!;
    expect(potion.dataset.itemKey).toBe(K.HEALTH_BOTTLE);
    expect(potion.dataset.itemAmount).toBe('3');
    expect(potion.dataset.rarity).toBeTruthy();
    expect(potion.dataset.price).toBe(String(coinPriceOf(K.HEALTH_BOTTLE)! * 3));
    expect(byId('shop-price-0')!.textContent.trim()).toBe(
      String(coinPriceOf(K.HEALTH_BOTTLE)! * 3),
    );
    expect(byId('shop-goods-cell-2')!.dataset.itemKey).toBeUndefined();
    expect(byId('shop-price-2')).toBeNull();
  });

  it('marks a price the purse cannot pay in red and a payable one not', () => {
    expect(byId('shop-price-0')!.classList.contains('is-short')).toBe(false);
    expect(byId('shop-price-1')!.classList.contains('is-short')).toBe(true);
  });

  it('shows the trader, the coins of the bag and the sell rate, but no weight', () => {
    const banner = byId('shop-trader-banner')!;
    expect(byId('shop-trader-name')!.textContent).toBe('Ilva the Pedlar');
    expect(byId('shop-coins')!.dataset.coins).toBe('100');
    expect(byId('shop-coins')!.textContent).toContain('100');
    expect(byId('shop-sell-rate')!.textContent).toBe('Pays 40% of price');
    expect(banner.textContent).not.toContain('kg');
  });

  it('shows the Buyback tab with a zero count while nothing was sold', () => {
    expect(byId('shop-tab-buyback')!.dataset.count).toBe('0');
    expect(byId('shop-buyback-pane')).toBeNull();
  });

  it('keeps the card at 160px with the empty hint before anything is picked', () => {
    expect(byId('shop-card')!.dataset.itemKey).toBeUndefined();
    expect(byId('shop-card')!.textContent).toContain('Pick an item');
  });

  it('reuses the stash bag with the same cells', () => {
    expect(all('stash-bag-cell-')).toHaveLength(53);
    expect(byId('stash-chest-pane')).toBeNull();
  });

  it('closes with the close button', async () => {
    byId('shop-close')!.click();
    await nextTick();
    expect(useTraderStore().isOpen).toBe(false);
  });
});

describe('shop board buyback and refresh', () => {
  it('lists sold items on the Buyback tab at the price they were sold for', async () => {
    const buyback = [{ key: K.SWORD, amount: 1, unitPrice: 200 }, ...EMPTY_ROW].slice(0, 7);
    await mountShop({ coins: 10, state: trader({ buyback }) });
    expect(byId('shop-tab-buyback')!.dataset.count).toBe('1');
    byId('shop-tab-buyback')!.click();
    await nextTick();
    expect(all('shop-buyback-cell-')).toHaveLength(7);
    expect(byId('shop-buyback-cell-0')!.dataset.itemKey).toBe(K.SWORD);
    expect(byId('shop-buyback-price-0')!.textContent.trim()).toBe('200');
    expect(byId('shop-buyback-price-0')!.classList.contains('is-short')).toBe(true);
    expect(byId('shop-goods-pane')).toBeNull();
  });

  it('shows the empty Buyback state', async () => {
    await mountShop();
    byId('shop-tab-buyback')!.click();
    await nextTick();
    expect(byId('shop-buyback-empty')!.textContent).toContain('Nothing to buy back');
  });

  async function hoverTip() {
    byId('shop-refresh')!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    return byId('shop-refresh-price')!;
  }

  it('shows the cost with the Will icon in a tooltip, 20 Will at the start', async () => {
    await mountShop({ will: 50 });
    const tip = await hoverTip();
    expect(tip.dataset.price).toBe('20');
    expect(tip.querySelector('img')).not.toBeNull();
    expect(tip.textContent).toContain('20');
    expect(byId('shop-refresh')!.nextElementSibling).toBe(tip);
  });

  it('marks the tooltip red when the Will is short', async () => {
    await mountShop({ will: 19 });
    expect(byId('shop-refresh')!.dataset.affordable).toBe('false');
    expect((await hoverTip()).classList.contains('is-short')).toBe(true);
  });

  it('doubles the price after a paid refresh on the same trip', async () => {
    await mountShop({ will: 50, state: trader({ paidRefreshes: 1 }) });
    expect((await hoverTip()).dataset.price).toBe('40');
    expect(byId('shop-refresh')!.dataset.affordable).toBe('true');
  });

  it('is an icon button named Refresh goods', async () => {
    await mountShop({ will: 50 });
    const button = byId('shop-refresh')!;
    expect(button.getAttribute('aria-label')).toBe('Refresh goods');
    expect(button.textContent.trim()).toBe('');
  });

  it('has no confirmation row any more', async () => {
    await mountShop({ will: 50 });
    byId('shop-refresh')!.click();
    await nextTick();
    expect(byId('shop-refresh-confirm-row')).toBeNull();
    expect(byId('shop-tab-goods')).not.toBeNull();
  });
});

describe('shop board without interaction yet', () => {
  it('never starts a stash drag or a stash quick move from the bag', async () => {
    await mountShop({ coins: 5 });
    const coinsCell = host.querySelector<HTMLElement>(`[data-item-key="${K.COINS}"]`)!;
    coinsCell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    coinsCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    coinsCell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await nextTick();
    expect(beginStashDrag).not.toHaveBeenCalled();
    expect(quickMove).not.toHaveBeenCalled();
    expect(useHeroInventoryStore().countItem(K.COINS)).toBe(5);
  });
});

describe('shop board tooltips', () => {
  async function hover(element: Element) {
    vi.useFakeTimers();
    element.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(200);
    await nextTick();
  }

  it('describes a good and adds its buy price', async () => {
    await mountShop({ coins: 30 });
    const tooltip = useItemTooltip();
    await hover(byId('shop-goods-cell-1')!.querySelector('.token')!);
    expect(tooltip.view.value?.key).toBe(K.SWORD);
    expect(tooltip.price.value).toEqual({
      kind: 'buy',
      coins: coinPriceOf(K.SWORD),
      affordable: false,
    });
  });

  it('adds the sell price to a bag item', async () => {
    await mountShop({ coins: 30 });
    useHeroInventoryStore().putToInventory(K.HEALTH_BOTTLE, 2);
    await nextTick();
    const potion = host.querySelector(`[data-item-key="${K.HEALTH_BOTTLE}"][data-drop-container]`)!;
    const tooltip = useItemTooltip();
    await hover(potion.querySelector('.token')!);
    expect(tooltip.view.value?.key).toBe(K.HEALTH_BOTTLE);
    expect(tooltip.price.value).toEqual({
      kind: 'sell',
      coins: sellUnitPrice(TRADERS.ilva, K.HEALTH_BOTTLE)! * 2,
      affordable: true,
    });
  });
});
