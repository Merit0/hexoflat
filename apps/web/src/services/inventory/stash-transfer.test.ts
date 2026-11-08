import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { readSavedStash } from '@/services/persistence/stash-storage';
import {
  autoPlaceItem,
  moveItem,
  readInventoryAggregate,
  sortStash,
  storeResources,
} from './stash-transfer';

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 10;
  return { inventory, stash };
}

function bagIndexOf(key: string): number {
  return readInventoryAggregate().bag.findIndex((item) => item?.key === key);
}

function occurrences(id: string): number {
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  return [...inventory.items, ...stash.cells].filter((item) => item?.id === id).length;
}

describe('stash transfers on the real stores', () => {
  beforeEach(() => setup());

  it('moves a bag item into the stash, once, and saves both sides', () => {
    const { inventory, stash } = setup();
    stash.open();
    inventory.putToInventory(K.HEALTH_BOTTLE, 3);
    const index = bagIndexOf(K.HEALTH_BOTTLE);
    const id = readInventoryAggregate().bag[index]!.id;

    const result = moveItem({ container: 'bag', index }, { container: 'stash', index: 5 });

    expect(result.ok).toBe(true);
    expect(inventory.countItem(K.HEALTH_BOTTLE)).toBe(0);
    expect(stash.cells[5]).toMatchObject({ id, amount: 3, slotKey: 'stash:5' });
    expect(occurrences(id)).toBe(1);
    expect(readSavedStash()?.[5]?.id).toBe(id);
  });

  it('refuses while the stash is closed and leaves both stores alone', () => {
    const { inventory, stash } = setup();
    inventory.putToInventory(K.HEALTH_BOTTLE, 3);
    const before = JSON.stringify([inventory.items, stash.cells]);

    const result = autoPlaceItem({ container: 'bag', index: bagIndexOf(K.HEALTH_BOTTLE) }, 'stash');

    expect(result).toEqual({ ok: false, reason: 'STASH_LOCKED' });
    expect(JSON.stringify([inventory.items, stash.cells])).toBe(before);
  });

  it('takes a worn weapon off into the stash and shows a bare hand again', () => {
    const { inventory, stash } = setup();
    stash.open();
    inventory.putToInventory(K.SWORD, 1);
    moveItem(
      { container: 'bag', index: bagIndexOf(K.SWORD) },
      { container: 'equip', slot: 'weapon' },
    );
    expect(inventory.equippedItems.weapon?.key).toBe(K.SWORD);

    const result = autoPlaceItem({ container: 'equip', slot: 'weapon' }, 'stash');

    expect(result.ok).toBe(true);
    expect(inventory.equippedItems.weapon?.key).toBe(K.HAND);
    expect(stash.cells.some((cell) => cell?.key === K.SWORD)).toBe(true);
  });

  it('keeps the stash out of the carried weight', () => {
    const { inventory, stash } = setup();
    stash.open();
    inventory.putToInventory(K.PICKAXE, 1);
    const before = inventory.carriedWeightKg;
    autoPlaceItem({ container: 'bag', index: bagIndexOf(K.PICKAXE) }, 'stash');
    expect(inventory.carriedWeightKg).toBeCloseTo(before - 1.5);
  });

  it('refuses to take a heavy item out when the bag cannot carry it', () => {
    const { inventory, stash } = setup();
    stash.open();
    inventory.putToInventory(K.SHIELD, 1);
    autoPlaceItem({ container: 'bag', index: bagIndexOf(K.SHIELD) }, 'stash');
    inventory.carryCapacityKg = inventory.carriedWeightKg + 1;

    const result = autoPlaceItem({ container: 'stash', index: 0 }, 'bag');

    expect(result).toEqual({ ok: false, reason: 'OVERWEIGHT' });
    expect(stash.cells[0]?.key).toBe(K.SHIELD);
  });

  it('stores resources and consumables, then sorts them into place', () => {
    const { inventory, stash } = setup();
    stash.open();
    inventory.putToInventory(K.COINS, 12);
    inventory.putToInventory(K.HEALTH_BOTTLE, 4);
    inventory.putToInventory(K.AXE, 1);

    const stored = storeResources();

    expect(stored.ok && stored.moved).toBeGreaterThanOrEqual(2);
    expect(inventory.countItem(K.COINS)).toBe(0);
    expect(inventory.countItem(K.AXE)).toBe(1);
    expect(sortStash().ok).toBe(true);
    const order = stash.cells.flatMap((cell) => (cell ? [cell.key] : []));
    expect(order.indexOf(K.HEALTH_BOTTLE)).toBeLessThan(order.indexOf(K.COINS));
  });
});
