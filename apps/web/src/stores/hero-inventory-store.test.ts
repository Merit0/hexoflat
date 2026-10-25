import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from './hero-inventory-store';

const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;

describe('useHeroInventoryStore: countItem / takeFromInventory', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('counts a stack and takes from it one at a time', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 3);

    expect(inventory.countItem(SCROLL)).toBe(3);
    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });
    expect(inventory.countItem(SCROLL)).toBe(2);
  });

  it('removes the stack when the last item is taken and refuses to overdraw', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 1);

    expect(inventory.takeFromInventory(SCROLL, 2)).toEqual({ ok: false });
    expect(inventory.countItem(SCROLL)).toBe(1);
    expect(inventory.takeFromInventory(SCROLL, 1)).toEqual({ ok: true });
    expect(inventory.items.some((item) => item.key === SCROLL)).toBe(false);
  });

  it('takes a scroll that sits in a hand slot and refills the hand with the default hand', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 1);
    const scroll = inventory.items.find((item) => item.key === SCROLL)!;
    inventory.moveItemToSlot(scroll.id, 'eq:weapon');

    inventory.takeFromInventory(SCROLL, 1);

    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });
});
