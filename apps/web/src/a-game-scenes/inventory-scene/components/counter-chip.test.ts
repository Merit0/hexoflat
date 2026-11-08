import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App, type Component } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import InventoryBoardGrid from './inventory-board-grid.vue';
import EquipToken from './equip-token.vue';

let app: App | null = null;
let host: HTMLElement;

function mount(component: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 50;
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(component, props).use(pinia).use(i18n);
  return inventory;
}

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
});

describe('counter chip in the Inventory grid', () => {
  let inventory: ReturnType<typeof useHeroInventoryStore>;
  beforeEach(() => {
    inventory = mount(InventoryBoardGrid);
  });

  const chipFor = (slotKey: string) =>
    host.querySelector<HTMLElement>(`[data-testid="inventory-amount-${slotKey}"]`);

  it('shows a chip on a stack of coins, whatever the amount', async () => {
    inventory.putToInventory(K.COINS, 1);
    app!.mount(host);
    await nextTick();
    const coins = inventory.items.find((item) => item.key === K.COINS)!;
    expect(chipFor(coins.slotKey)?.textContent?.trim()).toBe('1');

    inventory.putToInventory(K.COINS, 4);
    await nextTick();
    expect(chipFor(coins.slotKey)?.textContent?.trim()).toBe('5');
  });

  it('shows a chip on potions and scrolls and none on a sword', async () => {
    inventory.putToInventory(K.HEALTH_BOTTLE, 1);
    inventory.putToInventory(K.SWORD, 1);
    app!.mount(host);
    await nextTick();
    const bottle = inventory.items.find((item) => item.key === K.HEALTH_BOTTLE)!;
    const sword = inventory.items.find((item) => item.key === K.SWORD)!;
    const scroll = inventory.items.find((item) => item.key === K.RETURN_SCROLL)!;
    expect(chipFor(bottle.slotKey)?.textContent?.trim()).toBe('1');
    expect(chipFor(scroll.slotKey)).not.toBeNull();
    expect(chipFor(sword.slotKey)).toBeNull();
  });
});

describe('counter chip on an equipped token', () => {
  function equipped(key: (typeof K)[keyof typeof K], amount: number) {
    const inventory = mount(EquipToken, {
      item: {
        id: 'worn',
        key,
        type: 'loot',
        amount,
        slotKey: 'eq:weapon',
        isNew: false,
        stackKey: key,
      },
    });
    app!.mount(host);
    return inventory;
  }

  it('shows how many coins the hand holds', async () => {
    equipped(K.COINS, 140);
    await nextTick();
    expect(host.querySelector('[data-testid="equip-amount-worn"]')?.textContent?.trim()).toBe(
      '140',
    );
  });

  it('shows the chip for a single coin too', async () => {
    equipped(K.COINS, 1);
    await nextTick();
    expect(host.querySelector('[data-testid="equip-amount-worn"]')?.textContent?.trim()).toBe('1');
  });

  it('shows none for a sword', async () => {
    mount(EquipToken, {
      item: {
        id: 'worn',
        key: K.SWORD,
        type: 'equipment',
        amount: 1,
        slotKey: 'eq:weapon',
        isNew: false,
      },
    });
    app!.mount(host);
    await nextTick();
    expect(host.querySelector('[data-testid="equip-amount-worn"]')).toBeNull();
  });
});
