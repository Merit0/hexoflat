import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from './hero-inventory-store';

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

describe('useHeroInventoryStore: starter Return Scrolls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('a fresh hero starts with one stack of 50 scrolls, kept away from the first grid slots', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();

    expect(inventory.countItem(SCROLL)).toBe(50);
    expect(inventory.items.filter((item) => item.key === SCROLL)).toHaveLength(1);
    const slots = inventory.items.filter((item) => item.key === SCROLL).map((item) => item.slotKey);
    expect(slots).not.toContain('r0c1');
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('scrolls are used up one by one', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();

    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });
    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });

    expect(inventory.countItem(SCROLL)).toBe(48);
  });

  it('is granted once: a spent bag is not refilled on the next load', () => {
    const first = useHeroInventoryStore();
    first.hydrate();
    first.takeFromInventory(SCROLL, 50);
    expect(first.countItem(SCROLL)).toBe(0);

    setActivePinia(createPinia());
    const second = useHeroInventoryStore();
    second.hydrate();

    expect(second.countItem(SCROLL)).toBe(0);
  });

  it('a reload before any action does not grant the scrolls twice', () => {
    const first = useHeroInventoryStore();
    first.hydrate();

    setActivePinia(createPinia());
    const second = useHeroInventoryStore();
    second.hydrate();

    expect(second.countItem(SCROLL)).toBe(50);
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
