import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { readSavedStash } from '@/services/persistence/stash-storage';
import {
  autoPlaceItem,
  moveItem,
  unlockNextChest,
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
  stash.starterGiven = true;
  stash.setChests(1);
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
    expect(readSavedStash()?.cells[5]?.id).toBe(id);
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

  function holdCoins(amount: number, slot: 'weapon' | 'shield' = 'weapon') {
    const inventory = useHeroInventoryStore();
    inventory.putToInventory(K.COINS, amount);
    const index = readInventoryAggregate().bag.findIndex((item) => item?.key === K.COINS);
    moveItem({ container: 'bag', index }, { container: 'equip', slot });
    return inventory;
  }

  it('pays 100 from the coins in the hand for the first chest and keeps the rest there', () => {
    const { stash } = setup();
    stash.setChests(0);
    stash.open();
    const inventory = holdCoins(140);

    const unlocked = unlockNextChest();

    expect(unlocked.ok && unlocked.price).toBe(100);
    expect(stash.chests).toBe(1);
    expect(stash.ownedCells).toHaveLength(42);
    expect(inventory.equippedItems.weapon).toMatchObject({ key: K.COINS, amount: 40 });
    expect(stash.activeChest).toBe(0);
    expect(readSavedStash()?.chests).toBe(1);
  });

  it('keeps the starter gear of a locked first chest when it is paid for before the stash was ever opened', () => {
    setActivePinia(createPinia());
    localStorage.clear();
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const stash = useHeroStashStore();
    holdCoins(100);

    expect(unlockNextChest().ok).toBe(true);

    const keys = stash.ownedCells.flatMap((cell) => (cell ? [cell.key] : []));
    expect(keys.sort()).toEqual([K.AXE, K.PICKAXE, K.SHIELD, K.SWORD].sort());
    expect(readSavedStash()?.cells.filter(Boolean)).toHaveLength(4);
  });

  it('gives the bare hand back when the stack is exactly the price', () => {
    const { stash } = setup();
    stash.setChests(0);
    const inventory = holdCoins(100);
    expect(unlockNextChest().ok).toBe(true);
    expect(inventory.equippedItems.weapon?.key).toBe(K.HAND);
    expect(inventory.countItem(K.COINS)).toBe(0);
  });

  it('refuses 90 coins, reports the price and changes nothing', () => {
    const { stash } = setup();
    stash.setChests(0);
    const inventory = holdCoins(90);
    expect(unlockNextChest()).toEqual({ ok: false, reason: 'NOT_ENOUGH_COINS', price: 100 });
    expect(stash.chests).toBe(0);
    expect(inventory.equippedItems.weapon?.amount).toBe(90);
  });

  it('does not count coins that stay in the bag', () => {
    const { inventory, stash } = setup();
    stash.setChests(0);
    inventory.putToInventory(K.COINS, 5000);
    expect(unlockNextChest()).toEqual({ ok: false, reason: 'NO_COINS_IN_HAND', price: 100 });
    expect(stash.chests).toBe(0);
  });

  it('charges 1000 for the next chest and jumps to its tab', () => {
    const { stash } = setup();
    holdCoins(1200, 'shield');
    const unlocked = unlockNextChest();
    expect(unlocked.ok && unlocked.price).toBe(1000);
    expect(stash.chests).toBe(2);
    expect(stash.activeChest).toBe(1);
    expect(useHeroInventoryStore().equippedItems.shield?.amount).toBe(200);
  });

  it('works while the stash board is closed', () => {
    const { stash } = setup();
    stash.setChests(0);
    stash.close();
    holdCoins(100);
    expect(unlockNextChest().ok).toBe(true);
  });

  it('puts an item into the chest on view first', () => {
    const { inventory, stash } = setup();
    stash.setChests(2);
    stash.selectChest(1);
    stash.open();
    inventory.putToInventory(K.SWORD, 1);

    const result = autoPlaceItem({ container: 'bag', index: bagIndexOf(K.SWORD) }, 'stash');

    expect(result.ok).toBe(true);
    expect(stash.cells[42]?.key).toBe(K.SWORD);
    expect(stash.cells[0]).toBeNull();
  });

  it('asks for a chest when none is bought', () => {
    const { inventory, stash } = setup();
    stash.setChests(0);
    stash.open();
    inventory.putToInventory(K.SWORD, 1);
    expect(autoPlaceItem({ container: 'bag', index: bagIndexOf(K.SWORD) }, 'stash')).toEqual({
      ok: false,
      reason: 'NO_CHEST',
    });
  });
});
