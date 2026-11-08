import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { readInventoryAggregate } from '@/services/inventory/stash-transfer';
import { resetStashDrag, stashDrag } from '@/composables/stash-drag-state';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { quickMove } from '@/composables/use-stash-drag';
import { writeSavedStash } from '@/services/persistence/stash-storage';
import StashBoard from './stash-board.vue';

let app: App;
let host: HTMLElement;
let pointed: Element[] = [];

const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

function pointer(type: string, init: MouseEventInit) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
}

async function mountBoard() {
  const pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  writeSavedStash({ chests: 0, starterGiven: true, cells: [] });
  resetStashDrag();
  useHeroToolStore().clearActionMessage();
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 10;
  useHeroStashStore().setChests(1);
  useHeroStashStore().open();
  inventory.putToInventory(K.SWORD, 1);
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(StashBoard).use(pinia).use(i18n);
  app.mount(host);
  await nextTick();
  (document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => pointed;
}

describe('stash board with the pointer', () => {
  beforeEach(mountBoard);
  afterEach(() => {
    app.unmount();
    host.remove();
  });

  function swordCell() {
    return host.querySelector<HTMLElement>(
      '[data-testid^="stash-bag-cell-"][data-item-key="sword"]',
    )!;
  }

  it('does not start a drag for a small wobble, and a plain click does nothing', () => {
    const cell = swordCell();
    cell.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    window.dispatchEvent(pointer('pointermove', { clientX: 12, clientY: 12 }));
    window.dispatchEvent(pointer('pointerup', { clientX: 12, clientY: 12 }));
    expect(stashDrag.active).toBe(false);
    expect(useHeroStashStore().usedCount).toBe(0);
  });

  it('drags an item onto a stash cell and drops it there', async () => {
    const cell = swordCell();
    cell.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    pointed = [byId('stash-cell-9')];
    window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
    await nextTick();
    expect(stashDrag.active).toBe(true);
    expect(byId('stash-cell-9').classList.contains('is-valid')).toBe(true);
    expect(swordCell().classList.contains('is-lifted')).toBe(true);
    expect(swordCell().querySelector('.token')).toBeNull();
    expect(swordCell().querySelector('.amount')).toBeNull();
    expect(byId('stash-hint').textContent).toContain('Esc');

    window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    await nextTick();
    expect(useHeroStashStore().cells[9]?.key).toBe(K.SWORD);
    expect(stashDrag.active).toBe(false);
  });

  it('shows a red cell for a refused drop and keeps the item where it was', async () => {
    const inventory = useHeroInventoryStore();
    const stash = useHeroStashStore();
    inventory.putToInventory(K.SHIELD, 1);
    const shieldIndex = readInventoryAggregate().bag.findIndex((item) => item?.key === K.SHIELD);
    quickMove({ container: 'bag', index: shieldIndex });
    await nextTick();
    inventory.carryCapacityKg = inventory.carriedWeightKg + 0.5;
    const from = host.querySelector<HTMLElement>('[data-item-key="shield"]')!;
    expect(from.dataset.testid?.startsWith('stash-cell-')).toBe(true);

    from.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    pointed = [byId('stash-bag-cell-3')];
    window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
    await nextTick();
    expect(byId('stash-bag-cell-3').classList.contains('is-invalid')).toBe(true);
    expect(document.querySelector('[data-testid="stash-drag-badge"]')?.textContent).toBeTruthy();

    window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    await nextTick();
    expect(useHeroToolStore().actionMessage).toBeTruthy();
    expect(stash.usedCount).toBe(1);
  });

  it('carries the tile like the Inventory does: it grows a little and snaps bigger over a cell', async () => {
    swordCell().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    pointed = [];
    window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
    await nextTick();
    const ghost = document.querySelector<HTMLElement>('[data-testid="stash-drag-ghost"]')!;
    expect(ghost.style.transform).toBe('scale(1.05)');
    expect(ghost.style.left).toBe('50px');
    expect(ghost.style.top).toBe('70px');

    pointed = [byId('stash-cell-2')];
    window.dispatchEvent(pointer('pointermove', { clientX: 70, clientY: 90 }));
    await nextTick();
    expect(ghost.style.transform).toBe('scale(1.12)');
    window.dispatchEvent(pointer('pointerup', { clientX: 70, clientY: 90 }));
  });

  it('lights the cell a quick move would fill', async () => {
    const cell = swordCell();
    cell.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    pointed = [];
    window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
    await nextTick();
    expect(byId('stash-cell-0').classList.contains('is-next')).toBe(true);
    expect(byId('stash-cell-1').classList.contains('is-next')).toBe(false);
  });

  it('cancels with Escape and leaves the stash open', async () => {
    const cell = swordCell();
    cell.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    pointed = [byId('stash-cell-3')];
    window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(stashDrag.active).toBe(false);
    expect(useHeroStashStore().usedCount).toBe(0);
    expect(useHeroStashStore().isOpen).toBe(true);
  });

  it('sends an item across with a double click and with the right button', async () => {
    swordCell().dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await nextTick();
    expect(useHeroStashStore().usedCount).toBe(1);
    expect(useHeroToolStore().actionMessage).toBeNull();

    byId('stash-cell-0').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(useHeroStashStore().usedCount).toBe(0);
  });

  it('ignores the right button for dragging and empty cells for everything', () => {
    swordCell().dispatchEvent(pointer('pointerdown', { button: 2, clientX: 10, clientY: 10 }));
    window.dispatchEvent(pointer('pointermove', { clientX: 90, clientY: 90 }));
    expect(stashDrag.active).toBe(false);
    byId('stash-cell-0').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(useHeroStashStore().usedCount).toBe(0);
  });
});
