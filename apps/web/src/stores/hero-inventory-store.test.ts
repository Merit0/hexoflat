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
