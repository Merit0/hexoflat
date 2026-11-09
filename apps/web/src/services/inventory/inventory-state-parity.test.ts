import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EQUIP_SLOTS } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { BAG_SLOT_KEYS } from '@hexoflat/engine/inventory/bag-layout';
import { inventoryStateSchema } from '@hexoflat/engine/inventory/inventory-state';
import { migrateLegacyInventory } from '@hexoflat/engine/inventory/inventory-migration';
import { useHeroInventoryStore, WILL_SLOT_KEY } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';

function migrateFromStores() {
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  inventory.hydrate();
  stash.hydrate();
  return {
    inventory,
    stash,
    ...migrateLegacyInventory(
      'hero-1',
      { items: inventory.items, carryCapacityKg: inventory.carryCapacityKg },
      { chests: stash.chests, starterGiven: stash.starterGiven, cells: stash.cells },
    ),
  };
}

describe('InventoryState reads the same picture as the legacy stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('shares the bag cell order with the web grid', () => {
    const { inventory } = migrateFromStores();
    const addressable = inventory.allSlotKeys.filter((key) => {
      const [, row, col] = /^r(\d+)c(\d+)$/.exec(key)!.map(Number);
      return key !== WILL_SLOT_KEY && !inventory.isCellBlocked(row, col);
    });
    expect(addressable).toEqual([...BAG_SLOT_KEYS]);
  });

  it('matches cell by cell for a new hero', () => {
    const { inventory, stash, state, overflow } = migrateFromStores();
    expect(overflow).toEqual([]);
    expect(inventoryStateSchema.safeParse(state).success).toBe(true);
    BAG_SLOT_KEYS.forEach((slotKey, index) => {
      const legacy = inventory.itemsBySlot[slotKey];
      expect(state.bag[index]?.key).toBe(legacy?.key);
      expect(state.bag[index]?.amount).toBe(legacy?.amount);
    });
    stash.cells.forEach((legacy, index) => {
      expect(state.stash.cells[index]?.key).toBe(legacy?.key);
    });
    expect(state.stash.chests).toBe(stash.chests);
    expect(state.capacityKg).toBe(inventory.carryCapacityKg);
  });

  it('matches the hands after equipping', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    const sword = inventory.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!;
    inventory.moveItemToSlot(sword.id, 'eq:weapon');

    const { state } = migrateFromStores();
    for (const slot of EQUIP_SLOTS) {
      const legacy = inventory.equippedItems[slot];
      const expected = legacy?.key === HEXOBJECT_KEYS.HAND ? undefined : legacy?.key;
      expect(state.equip[slot]?.key).toBe(expected);
    }
  });
});
