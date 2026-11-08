import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { getMeta, getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { readInventoryAggregate } from '@/services/inventory/stash-transfer';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { stashErrorText, stashNothingToStoreText } from '@/composables/stash-messages';
import { writeSavedStash } from '@/services/persistence/stash-storage';
import StashBoard from './stash-board.vue';

let app: App | null = null;
let host: HTMLElement;

function stashItem(key: (typeof K)[keyof typeof K], amount: number, index: number): InventoryItem {
  return {
    id: `stash-${index}`,
    key,
    type: getPrototype(key).groupType,
    stackKey: getMeta(key)?.traits?.stackable ? key : undefined,
    amount,
    slotKey: `stash:${index}`,
    isNew: false,
  };
}

async function mountBoard() {
  const pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  writeSavedStash({ chests: 0, starterGiven: true, cells: [] });
  useHeroToolStore().clearActionMessage();
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 10;
  useHeroStashStore().open();
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(StashBoard).use(pinia).use(i18n);
  app.mount(host);
  await nextTick();
}

const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const all = (prefix: string) => host.querySelectorAll(`[data-testid^="${prefix}"]`);

async function ownChests(count: number) {
  useHeroStashStore().setChests(count);
  await nextTick();
}

describe('stash board layout', () => {
  beforeEach(mountBoard);
  afterEach(() => {
    app?.unmount();
    host.remove();
  });

  it('scrolls only the bag, inside a box capped at six rows, and never sideways', () => {
    const scrollers = host.querySelectorAll('[data-scroller]');
    expect(scrollers).toHaveLength(1);
    expect(byId('stash-bag-pane')!.contains(scrollers[0])).toBe(true);
    expect(byId('stash-bag-pane')!.querySelector('.bag-scroll')).not.toBeNull();
    expect(byId('stash-chest-pane')!.querySelector('[data-scroller]')).toBeNull();
  });

  it('puts the stash above the bag', () => {
    const stash = byId('stash-chest-pane')!;
    const bag = byId('stash-bag-pane')!;
    expect(stash.compareDocumentPosition(bag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the bag as a seven column grid and no equipment row or divider', () => {
    expect(byId('stash-board')).not.toBeNull();
    expect(byId('stash-bag-pane')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid^="stash-bag-cell-"]')).toHaveLength(53);
    expect(byId('stash-equip-toggle')).toBeNull();
    expect(byId('stash-splitter')).toBeNull();
    expect(all('stash-equip-')).toHaveLength(0);
  });

  it('lists every bag item first, sorted by category, rarity and key, free cells after them', async () => {
    const inventory = useHeroInventoryStore();
    for (const key of [K.COINS, K.SWORD, K.HEALTH_BOTTLE, K.AXE, K.SHIELD]) {
      inventory.putToInventory(key, key === K.COINS ? 5 : 1);
    }
    await nextTick();

    const shown = [...host.querySelectorAll<HTMLElement>('[data-testid^="stash-bag-cell-"]')];
    const keys = shown.map((cell) => cell.dataset.itemKey);
    expect(keys.slice(0, 6)).toEqual([
      K.SHIELD,
      K.SWORD,
      K.AXE,
      K.RETURN_SCROLL,
      K.HEALTH_BOTTLE,
      K.COINS,
    ]);
    expect(keys.slice(6).every((key) => key === undefined)).toBe(true);
    expect(shown).toHaveLength(53);
  });

  it('keeps pointing every shown cell at its real bag cell, free ones included', async () => {
    const inventory = useHeroInventoryStore();
    inventory.putToInventory(K.SWORD, 1);
    inventory.putToInventory(K.AXE, 1);
    await nextTick();

    const bag = readInventoryAggregate().bag;
    const shown = [...host.querySelectorAll<HTMLElement>('[data-testid^="stash-bag-cell-"]')];
    const indices = shown.map((cell) => Number(cell.dataset.dropIndex));
    expect(new Set(indices).size).toBe(53);
    shown.forEach((cell, position) => {
      const real = bag[indices[position]];
      expect(real?.key).toBe(cell.dataset.itemKey);
    });
  });

  it('hands the Inventory cell size to the grids through CSS variables', () => {
    const style = byId('stash-board')!.getAttribute('style') ?? '';
    expect(style).toContain('--stash-cell');
    expect(style).toContain('--stash-gap');
    expect(style).toContain('--stash-pad');
  });

  describe('before the first chest is bought', () => {
    it('offers five tabs, the first one selected, and the first chest for 100 coins', () => {
      expect(all('stash-tab-')).toHaveLength(5);
      expect(byId('stash-tab-1')?.getAttribute('aria-selected')).toBe('true');
      expect(byId('stash-tab-1')?.dataset.state).toBe('locked');
      expect(byId('stash-chest-grid')).toBeNull();
      expect(byId('stash-shop')).not.toBeNull();
      expect(byId('stash-price')?.querySelector('.cost')?.textContent).toBe('100');
    });

    it('shows only the chest and the price with the coin sprite, no button and no extra text', () => {
      const shop = byId('stash-shop')!;
      expect(shop.textContent?.trim()).toBe('100');
      expect(byId('stash-price')?.querySelector('img.coin')?.getAttribute('src')).toContain('coin');
      expect(byId('stash-buy-chest')).toBeNull();
      expect(shop.querySelector('button')).toBeNull();
      expect(shop.querySelector('h4')).toBeNull();
    });

    it('explains how to pay when the price is hovered, through the hero message', async () => {
      byId('stash-price')!.dispatchEvent(new MouseEvent('mouseenter'));
      await nextTick();
      const tool = useHeroToolStore();
      expect(tool.actionMessage).toContain('coins');
      expect(tool.actionMessageTone).toBe('info');
    });

    it('does not buy anything by clicking the price', async () => {
      useHeroInventoryStore().putToInventory(K.COINS, 500);
      byId('stash-price')!.click();
      await nextTick();
      expect(useHeroStashStore().chests).toBe(0);
      expect(useHeroInventoryStore().countItem(K.COINS)).toBe(500);
    });

    it('opens the chest cells once the next chest is unlocked elsewhere', async () => {
      useHeroStashStore().setChests(1);
      await nextTick();
      expect(byId('stash-shop')).toBeNull();
      expect(host.querySelectorAll('[data-testid^="stash-cell-"]')).toHaveLength(42);
      expect(byId('stash-tab-1')?.dataset.state).toBe('owned');
    });
  });

  describe('with chests', () => {
    beforeEach(() => ownChests(1));

    it('shows the 42 cells of the chest on view', () => {
      expect(host.querySelectorAll('[data-testid^="stash-cell-"]')).toHaveLength(42);
      expect(byId('stash-cell-0')).not.toBeNull();
      expect(byId('stash-cell-41')).not.toBeNull();
      expect(byId('stash-cell-42')).toBeNull();
    });

    it('marks a stash cell with the item, its amount and its rarity tone', async () => {
      const stash = useHeroStashStore();
      const cells = stash.ownedCells.slice();
      cells[5] = stashItem(K.SWORD, 1, 5);
      cells[6] = stashItem(K.HEALTH_BOTTLE, 7, 6);
      stash.replaceOwnedCells(cells);
      await nextTick();

      expect(byId('stash-cell-5')?.dataset.itemKey).toBe(K.SWORD);
      expect(byId('stash-cell-5')?.dataset.rarity).toBeTruthy();
      expect(byId('stash-cell-6')?.dataset.itemAmount).toBe('7');
      expect(byId('stash-cell-6')?.querySelector('.amount')?.textContent).toBe('7');
      expect(byId('stash-cell-0')?.dataset.itemKey).toBeUndefined();
      expect(byId('stash-count')?.textContent).toContain('2 / 42');
    });

    it('offers the next chest for 1000 and keeps the later ones behind it', async () => {
      byId('stash-tab-2')!.click();
      await nextTick();
      expect(byId('stash-price')?.textContent).toContain('1000');

      byId('stash-tab-3')!.click();
      await nextTick();
      expect(byId('stash-price')).toBeNull();
      expect(byId('stash-buy-after')?.getAttribute('aria-label')).toContain('2');
      expect(byId('stash-shop')?.textContent?.trim()).toBe('');
    });

    it('shows the cells of the other chest after a switch', async () => {
      await ownChests(2);
      const stash = useHeroStashStore();
      const cells = stash.ownedCells.slice();
      cells[45] = stashItem(K.AXE, 1, 45);
      stash.replaceOwnedCells(cells);
      byId('stash-tab-2')!.click();
      await nextTick();

      expect(byId('stash-cell-0')).toBeNull();
      expect(byId('stash-cell-45')?.dataset.itemKey).toBe(K.AXE);
      expect(byId('stash-count')?.textContent).toContain('1 / 84');
    });

    it('puts a counter on a stack of one coin, like the Will, and none on gear', async () => {
      const stash = useHeroStashStore();
      const cells = stash.ownedCells.slice();
      cells[0] = stashItem(K.COINS, 1, 0);
      cells[1] = stashItem(K.SWORD, 1, 1);
      stash.replaceOwnedCells(cells);
      await nextTick();
      expect(byId('stash-cell-0')?.querySelector('.amount')?.textContent).toBe('1');
      expect(byId('stash-cell-1')?.querySelector('.amount')).toBeNull();
    });

    it('shows the weight of the bag', () => {
      expect(byId('stash-load-value')?.textContent).toMatch(/\d+(\.\d)? \/ 10/);
    });

    it('closes the stash with the close button', () => {
      const stash = useHeroStashStore();
      stash.open();
      byId('stash-close')!.click();
      expect(stash.isOpen).toBe(false);
    });
  });
});

describe('stash filters, actions and the bag overflow button', () => {
  beforeEach(mountBoard);
  afterEach(() => {
    app?.unmount();
    host.remove();
  });

  async function fillChest() {
    await ownChests(1);
    const stash = useHeroStashStore();
    const cells = stash.ownedCells.slice();
    cells[0] = stashItem(K.SWORD, 1, 0);
    cells[1] = stashItem(K.AXE, 1, 1);
    cells[2] = stashItem(K.HEALTH_BOTTLE, 3, 2);
    cells[3] = stashItem(K.COINS, 9, 3);
    stash.replaceOwnedCells(cells);
    await nextTick();
  }

  it('offers the five filters with All chosen, only while a chest is on view', async () => {
    expect(all('stash-filter-')).toHaveLength(0);
    await ownChests(1);
    expect(all('stash-filter-')).toHaveLength(5);
    expect(byId('stash-filter-all')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('dims what does not match, keeps every item in place and keeps empty cells open', async () => {
    await fillChest();
    byId('stash-filter-gear')!.click();
    await nextTick();

    expect(byId('stash-cell-0')?.classList.contains('is-dim')).toBe(false);
    expect(byId('stash-cell-1')?.classList.contains('is-dim')).toBe(true);
    expect(byId('stash-cell-2')?.classList.contains('is-dim')).toBe(true);
    expect(byId('stash-cell-3')?.classList.contains('is-dim')).toBe(true);
    expect(byId('stash-cell-10')?.classList.contains('is-dim')).toBe(false);
    expect(byId('stash-cell-1')?.dataset.itemKey).toBe(K.AXE);
    expect(byId('stash-cell-10')?.dataset.dropIndex).toBe('10');

    byId('stash-filter-consumable')!.click();
    await nextTick();
    expect(byId('stash-cell-2')?.classList.contains('is-dim')).toBe(false);
    expect(byId('stash-cell-0')?.classList.contains('is-dim')).toBe(true);

    byId('stash-filter-all')!.click();
    await nextTick();
    expect(host.querySelectorAll('.is-dim')).toHaveLength(0);
  });

  it('stores the resources and consumables of the bag, and keeps gear in the bag', async () => {
    await ownChests(1);
    const inventory = useHeroInventoryStore();
    inventory.putToInventory(K.COINS, 12);
    inventory.putToInventory(K.HEALTH_BOTTLE, 2);
    inventory.putToInventory(K.SWORD, 1);

    byId('stash-store-resources')!.click();
    await nextTick();

    expect(inventory.countItem(K.COINS)).toBe(0);
    expect(inventory.countItem(K.SWORD)).toBe(1);
    const stored = [...host.querySelectorAll<HTMLElement>('[data-testid^="stash-cell-"]')]
      .map((cell) => cell.dataset.itemKey)
      .filter(Boolean);
    expect(stored).toEqual(expect.arrayContaining([K.COINS, K.HEALTH_BOTTLE]));
    expect(stored).not.toContain(K.SWORD);
  });

  it('says there is nothing to store instead of staying silent', async () => {
    await ownChests(1);
    const inventory = useHeroInventoryStore();
    inventory.takeFromInventory(K.RETURN_SCROLL, inventory.countItem(K.RETURN_SCROLL));
    byId('stash-store-resources')!.click();
    await nextTick();
    const tool = useHeroToolStore();
    expect(tool.actionMessage).toBe(stashNothingToStoreText());
    expect(tool.actionMessageTone).toBe('info');
  });

  it('asks to unlock a chest first when there is none', () => {
    byId('stash-store-resources')!.click();
    expect(useHeroToolStore().actionMessage).toBe(stashErrorText('NO_CHEST'));
    useHeroToolStore().clearActionMessage();
    byId('stash-sort')!.click();
    expect(useHeroToolStore().actionMessage).toBe(stashErrorText('NO_CHEST'));
  });

  it('sorts the stash: merges stacks, gear first, resources last', async () => {
    await ownChests(1);
    const stash = useHeroStashStore();
    const cells = stash.ownedCells.slice();
    cells[0] = stashItem(K.COINS, 4, 0);
    cells[5] = stashItem(K.SWORD, 1, 5);
    cells[9] = stashItem(K.COINS, 6, 9);
    cells[12] = stashItem(K.AXE, 1, 12);
    stash.replaceOwnedCells(cells);
    await nextTick();

    byId('stash-sort')!.click();
    await nextTick();

    const order = [...host.querySelectorAll<HTMLElement>('[data-testid^="stash-cell-"]')].map(
      (cell) => cell.dataset.itemKey ?? null,
    );
    expect(order.slice(0, 4)).toEqual([K.SWORD, K.AXE, K.COINS, null]);
    expect(byId('stash-cell-2')?.dataset.itemAmount).toBe('10');
  });

  describe('the bag overflow button', () => {
    function stubLayout(scrollTop: number, clientHeight: number, rowHeight: number) {
      const scroller = host.querySelector<HTMLElement>('[data-scroller]')!;
      Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        value: scrollTop,
        writable: true,
      });
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: clientHeight });
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: rowHeight * 8 });
      host
        .querySelectorAll<HTMLElement>('[data-testid^="stash-bag-cell-"]')
        .forEach((cell, index) => {
          Object.defineProperty(cell, 'offsetTop', {
            configurable: true,
            value: Math.floor(index / 7) * rowHeight,
          });
        });
      scroller.dispatchEvent(new Event('scroll'));
    }

    it('counts the items hidden below and hides when everything is in view', async () => {
      const inventory = useHeroInventoryStore();
      for (const key of [
        K.SWORD,
        K.SHIELD,
        K.AXE,
        K.PICKAXE,
        K.HEALTH_BOTTLE,
        K.COINS,
        K.BONE_CHARM,
        K.CROWN_SHARD,
      ]) {
        inventory.putToInventory(key, 1);
      }
      await nextTick();
      expect(byId('stash-more-bag')).toBeNull();

      stubLayout(0, 40, 50);
      await nextTick();
      expect(byId('stash-more-bag')).not.toBeNull();
      expect(byId('stash-more-bag')?.textContent).toContain('2');

      stubLayout(300, 100, 50);
      await nextTick();
      expect(byId('stash-more-bag')).toBeNull();
    });

    it('scrolls about one page down on click', async () => {
      const inventory = useHeroInventoryStore();
      for (const key of [
        K.SWORD,
        K.SHIELD,
        K.AXE,
        K.PICKAXE,
        K.HEALTH_BOTTLE,
        K.COINS,
        K.BONE_CHARM,
        K.CROWN_SHARD,
      ]) {
        inventory.putToInventory(key, 1);
      }
      await nextTick();
      stubLayout(0, 40, 50);
      await nextTick();
      const scroller = host.querySelector<HTMLElement>('[data-scroller]')!;
      Object.defineProperty(scroller, 'scrollBy', { configurable: true, value: undefined });
      byId('stash-more-bag')!.click();
      expect(scroller.scrollTop).toBe(32);
    });
  });
});
