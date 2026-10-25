import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
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

describe('useHeroInventoryStore: unlimited Return Scrolls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('a fresh hero starts with a scroll, away from the first grid slots', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();

    const scroll = inventory.items.find((item) => item.key === SCROLL);
    expect(scroll).toBeDefined();
    expect(scroll!.slotKey).not.toBe('r0c1');
  });

  it('taking scrolls never uses them up', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const before = inventory.countItem(SCROLL);

    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });
    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });

    expect(inventory.countItem(SCROLL)).toBe(before);
  });

  it('a scroll lost from a saved bag comes back on the next hydrate', () => {
    const first = useHeroInventoryStore();
    first.hydrate();
    first.items = first.items.filter((item) => item.key !== SCROLL);
    first.persist();

    setActivePinia(createPinia());
    const second = useHeroInventoryStore();
    second.hydrate();

    expect(second.countItem(SCROLL)).toBeGreaterThan(0);
  });
});
