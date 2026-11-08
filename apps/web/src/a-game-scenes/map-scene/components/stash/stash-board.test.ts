import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { getMeta, getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
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
  useHeroInventoryStore().hydrate();
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(StashBoard).use(pinia).use(i18n);
  app.mount(host);
  await nextTick();
}

const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('stash board layout', () => {
  beforeEach(mountBoard);
  afterEach(() => {
    app?.unmount();
    host.remove();
  });

  it('shows the bag with eight equipment slots and the stash with 64 cells', () => {
    expect(byId('stash-board')).not.toBeNull();
    expect(byId('stash-bag-pane')).not.toBeNull();
    expect(byId('stash-chest-pane')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid^="stash-equip-"]').length).toBe(8 + 1);
    expect(host.querySelectorAll('[data-testid^="stash-cell-"]')).toHaveLength(64);
    expect(host.querySelectorAll('[data-testid^="stash-bag-cell-"]')).toHaveLength(53);
  });

  it('shows how much the stash holds and how heavy the bag is', () => {
    const stash = useHeroStashStore();
    const cells = stash.cells.slice();
    cells[2] = stashItem(K.HEALTH_BOTTLE, 4, 2);
    stash.replaceCells(cells);
    return nextTick().then(() => {
      expect(byId('stash-count')?.textContent).toContain('1 / 64');
      expect(byId('stash-load-value')?.textContent).toMatch(/\d+(\.\d)? \/ 10/);
    });
  });

  it('marks a stash cell with the item, its amount and its rarity tone', async () => {
    const stash = useHeroStashStore();
    const cells = stash.cells.slice();
    cells[5] = stashItem(K.SWORD, 1, 5);
    cells[6] = stashItem(K.HEALTH_BOTTLE, 7, 6);
    stash.replaceCells(cells);
    await nextTick();

    const sword = byId('stash-cell-5');
    expect(sword?.dataset.itemKey).toBe(K.SWORD);
    expect(sword?.dataset.rarity).toBeTruthy();
    const potion = byId('stash-cell-6');
    expect(potion?.dataset.itemAmount).toBe('7');
    expect(potion?.querySelector('.amount')?.textContent).toBe('7');
    expect(byId('stash-cell-0')?.dataset.itemKey).toBeUndefined();
  });

  it('collapses the equipped row and back', async () => {
    const toggle = byId('stash-equip-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await nextTick();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.minis')).not.toBeNull();
  });

  it('closes the stash with the close button', () => {
    const stash = useHeroStashStore();
    stash.open();
    byId('stash-close')!.click();
    expect(stash.isOpen).toBe(false);
  });

  it('moves the divider with the arrow keys and keeps it between 25 and 75 percent', async () => {
    const settings = useUiSettingsStore();
    const splitter = byId('stash-splitter')!;
    expect(splitter.getAttribute('aria-valuenow')).toBe('50');

    splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await nextTick();
    expect(settings.stashSplitRatio).toBeCloseTo(0.45);
    expect(splitter.getAttribute('aria-valuenow')).toBe('45');

    for (let i = 0; i < 20; i += 1) {
      splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await nextTick();
    }
    expect(settings.stashSplitRatio).toBe(0.25);
  });

  it('resets the divider with a double click', () => {
    const settings = useUiSettingsStore();
    settings.setStashSplitRatio(0.7);
    byId('stash-splitter')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(settings.stashSplitRatio).toBe(0.5);
  });
});
