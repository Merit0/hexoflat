import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { bindInventoryHandsGate, useHeroInventoryStore } from './hero-inventory-store';

const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;
const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;

describe('useHeroInventoryStore: countItem / takeFromInventory', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('counts a stack and takes from it one at a time', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(POTION, 3);

    expect(inventory.countItem(POTION)).toBe(3);
    expect(inventory.takeFromInventory(POTION, 1)).toEqual({ ok: true });
    expect(inventory.countItem(POTION)).toBe(2);
  });

  it('removes the stack when the last item is taken and refuses to overdraw', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(POTION, 1);

    expect(inventory.takeFromInventory(POTION, 2)).toEqual({ ok: false });
    expect(inventory.countItem(POTION)).toBe(1);
    expect(inventory.takeFromInventory(POTION, 1)).toEqual({ ok: true });
    expect(inventory.items.some((item) => item.key === POTION)).toBe(false);
  });

  it('takes a potion that sits in a hand slot and refills the hand with the default hand', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(POTION, 1);
    const potion = inventory.items.find((item) => item.key === POTION)!;
    inventory.moveItemToSlot(potion.id, 'eq:weapon');

    inventory.takeFromInventory(POTION, 1);

    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });
});

describe('useHeroInventoryStore: a fresh hero', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('starts with nothing in the bag, only the two bare hands', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();

    expect(inventory.items.every((item) => item.key === HEXOBJECT_KEYS.HAND)).toBe(true);
    expect(inventory.countItem(SCROLL)).toBe(0);
    expect(inventory.countItem(HEXOBJECT_KEYS.COINS)).toBe(0);
  });

  it('keeps nothing in localStorage: a new store starts empty again', () => {
    const first = useHeroInventoryStore();
    first.hydrate();
    first.putToInventory(SCROLL, 5);

    setActivePinia(createPinia());
    const second = useHeroInventoryStore();
    second.hydrate();

    expect(second.countItem(SCROLL)).toBe(0);
  });

  it('uses granted scrolls one by one', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 5);

    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });
    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });

    expect(inventory.countItem(SCROLL)).toBe(3);
  });
});

describe('useHeroInventoryStore: unequipHand', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('moves the held item into the bag and leaves the default hand', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 5);
    const scroll = inventory.items.find((item) => item.key === SCROLL)!;
    inventory.moveItemToSlot(scroll.id, 'eq:weapon');
    expect(inventory.equippedItems.weapon?.key).toBe(SCROLL);

    expect(inventory.unequipHand('weapon')).toBe(true);
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
    expect(inventory.items.find((item) => item.id === scroll.id)?.slotKey).not.toBe('eq:weapon');
    expect(inventory.countItem(SCROLL)).toBeGreaterThan(0);
  });

  it('does nothing for an empty hand', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    expect(inventory.unequipHand('shield')).toBe(false);
  });

  it('keeps the item in the hand when the bag is full', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 5);
    const scroll = inventory.items.find((item) => item.key === SCROLL)!;
    inventory.moveItemToSlot(scroll.id, 'eq:weapon');
    for (const slotKey of [...inventory.freeSlotKeys]) {
      const id = crypto.randomUUID();
      inventory.items.push({
        id,
        key: POTION,
        type: EHexobjectGroup.LOOT,
        stackKey: id,
        amount: 1,
        slotKey,
        isNew: false,
      });
    }
    expect(inventory.freeSlotKeys).toHaveLength(0);

    expect(inventory.unequipHand('weapon')).toBe(false);
    expect(inventory.equippedItems.weapon?.key).toBe(SCROLL);
  });
});

describe('useHeroInventoryStore: hands gate (equipment changes during a battle)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => bindInventoryHandsGate(null));

  function sword(inventory: ReturnType<typeof useHeroInventoryStore>) {
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    return inventory.items.find((item) => item.key === HEXOBJECT_KEYS.SWORD)!;
  }

  it('keeps an equip the gate accepts', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const item = sword(inventory);
    bindInventoryHandsGate(() => true);

    inventory.moveItemToSlot(item.id, 'eq:weapon');

    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.SWORD);
  });

  it('puts everything back when the gate refuses the new hands', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const item = sword(inventory);
    const slotBefore = item.slotKey;
    bindInventoryHandsGate(() => false);

    inventory.moveItemToSlot(item.id, 'eq:weapon');

    expect(inventory.items.find((i) => i.id === item.id)?.slotKey).toBe(slotBefore);
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });

  it('does not ask the gate about moves that leave the hands alone', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const item = sword(inventory);
    let asked = 0;
    bindInventoryHandsGate(() => {
      asked += 1;
      return false;
    });

    inventory.moveItemToSlot(item.id, inventory.freeSlotKeys[0]);

    expect(asked).toBe(0);
  });
});
