import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

describe('item order after a command', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('keeps an item at its place in the list when it moves into a hand', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    inventory.putToInventory(HEXOBJECT_KEYS.AXE, 1);
    const before = inventory.items.map((item) => item.id);
    const sword = inventory.items.find((item) => item.key === HEXOBJECT_KEYS.SWORD)!;

    inventory.moveItemToSlot(sword.id, 'eq:weapon');

    const swordIndex = before.indexOf(sword.id);
    expect(inventory.items.findIndex((item) => item.id === sword.id)).toBe(swordIndex);
    expect(inventory.items.find((item) => item.key === HEXOBJECT_KEYS.SWORD)?.slotKey).toBe(
      'eq:weapon',
    );
  });

  it('puts new items after the ones that were already there', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const carried = () =>
      inventory.items.filter((item) => item.key !== HEXOBJECT_KEYS.HAND).map((item) => item.id);
    const known = carried();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    expect(carried().slice(0, known.length)).toEqual(known);
    expect(carried()).toHaveLength(known.length + 1);
  });
});
