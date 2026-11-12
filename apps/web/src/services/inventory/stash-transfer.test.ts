import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import {
  autoPlaceItem,
  moveItem,
  unlockNextChest,
  readInventoryAggregate,
  sortStash,
  storeResources,
} from './stash-transfer';

const [CHEST] = campObjectSpots(K.STASH_CHEST);
const AT_CHEST = { locationKey: 'camping', coordinates: getHexNeighbors(CHEST)[0] };
const FAR_FROM_CHEST = {
  locationKey: 'camping',
  coordinates: { columnIndex: CHEST.columnIndex + 2, rowIndex: CHEST.rowIndex },
};

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 10;
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

  it('moves a bag item into the stash, once', () => {
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

  it('pays 100 from the coins in the hand for the second chest and keeps the rest there', () => {
    const { stash } = setup();
    stash.open();
    const inventory = holdCoins(140);

    const unlocked = unlockNextChest(AT_CHEST);

    expect(unlocked.ok && unlocked.price).toBe(100);
    expect(stash.chests).toBe(2);
    expect(stash.ownedCells).toHaveLength(84);
    expect(inventory.equippedItems.weapon).toMatchObject({ key: K.COINS, amount: 40 });
    expect(stash.activeChest).toBe(1);
  });

  it('refuses to buy the first chest: it only comes free from the camp', () => {
    const { stash } = setup();
    stash.setChests(0);
    holdCoins(5000);

    expect(unlockNextChest(AT_CHEST)).toEqual({
      ok: false,
      reason: 'CAMP_CHEST_NOT_CLAIMED',
      price: 0,
    });
    expect(stash.chests).toBe(0);
  });

  it('gives the bare hand back when the stack is exactly the price', () => {
    setup();
    const inventory = holdCoins(100);
    expect(unlockNextChest(AT_CHEST).ok).toBe(true);
    expect(inventory.equippedItems.weapon?.key).toBe(K.HAND);
    expect(inventory.countItem(K.COINS)).toBe(0);
  });

  it('refuses 90 coins, reports the price and changes nothing', () => {
    const { stash } = setup();
    const inventory = holdCoins(90);
    expect(unlockNextChest(AT_CHEST)).toEqual({
      ok: false,
      reason: 'NOT_ENOUGH_COINS',
      price: 100,
    });
    expect(stash.chests).toBe(1);
    expect(inventory.equippedItems.weapon?.amount).toBe(90);
  });

  it('does not count coins that stay in the bag', () => {
    const { inventory, stash } = setup();
    inventory.putToInventory(K.COINS, 5000);
    expect(unlockNextChest(AT_CHEST)).toEqual({
      ok: false,
      reason: 'NO_COINS_IN_HAND',
      price: 100,
    });
    expect(stash.chests).toBe(1);
  });

  it('charges 1000 for the next chest and jumps to its tab', () => {
    const { stash } = setup();
    stash.setChests(2);
    holdCoins(1200, 'shield');
    const unlocked = unlockNextChest(AT_CHEST);
    expect(unlocked.ok && unlocked.price).toBe(1000);
    expect(stash.chests).toBe(3);
    expect(stash.activeChest).toBe(2);
    expect(useHeroInventoryStore().equippedItems.shield?.amount).toBe(200);
  });

  it('works while the stash board is closed', () => {
    const { stash } = setup();
    stash.close();
    holdCoins(100);
    expect(unlockNextChest(AT_CHEST).ok).toBe(true);
  });

  it('refuses away from the chest with STASH_LOCKED and changes nothing', () => {
    const { stash } = setup();
    stash.open();
    const inventory = holdCoins(140);

    expect(unlockNextChest(FAR_FROM_CHEST)).toEqual({
      ok: false,
      reason: 'STASH_LOCKED',
      price: 100,
    });
    expect(unlockNextChest(null)).toMatchObject({ ok: false, reason: 'STASH_LOCKED' });
    expect(stash.chests).toBe(1);
    expect(inventory.equippedItems.weapon?.amount).toBe(140);
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
