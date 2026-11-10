import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { inventoryStateFromStores } from './inventory-bridge';

const HERO = 'hero-1';
const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  return { inventory };
}

describe('inventory bridge: state from the stores', () => {
  beforeEach(() => setup());

  it('shows the same bag, hands and capacity as the store', () => {
    const { inventory } = setup();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    inventory.moveItemToSlot(
      inventory.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!.id,
      'eq:weapon',
    );
    const state = inventoryStateFromStores(HERO);
    expect(state.equip.weapon?.key).toBe(HEXOBJECT_KEYS.SWORD);
    expect(state.equip.shield).toBeNull();
    expect(state.capacityKg).toBe(inventory.carryCapacityKg);
  });

  it('continues the id sequence of items it created earlier', () => {
    const { inventory } = setup();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    inventory.putToInventory(HEXOBJECT_KEYS.AXE, 1);
    const ids = useHeroInventoryStore().items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('hero:')).length).toBeGreaterThanOrEqual(2);
  });
});

describe('inventory bridge: grant and consume', () => {
  it('grants into the store with isNew and a rotation, and saves nothing locally', () => {
    const { inventory } = setup();
    const result = inventory.putToInventory(POTION, 2);
    expect(result.ok).toBe(true);
    const potion = inventory.items.find((i) => i.key === POTION)!;
    expect(potion).toMatchObject({ amount: 2, isNew: true });
    expect(inventory.rotationsById[potion.id]).toBeDefined();
    expect(localStorage.length).toBe(0);
  });

  it('tops up the existing stack and keeps the hands filled', () => {
    const { inventory } = setup();
    inventory.putToInventory(POTION, 1);
    inventory.putToInventory(POTION, 1);
    expect(inventory.items.filter((i) => i.key === POTION)).toHaveLength(1);
    expect(inventory.countItem(POTION)).toBe(2);
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });

  it('answers with the legacy messages and changes nothing when it cannot', () => {
    const { inventory } = setup();
    inventory.carryCapacityKg = inventory.carriedWeightKg;
    const before = JSON.stringify(inventory.items);
    const heavy = inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    expect(heavy.ok).toBe(false);
    expect(heavy.message).toMatch(/^Too heavy! Carry limit/);
    expect(JSON.stringify(inventory.items)).toBe(before);
  });

  it('consumes from a hand and refills it with the bare hand', () => {
    const { inventory } = setup();
    inventory.putToInventory(POTION, 1);
    inventory.moveItemToSlot(inventory.items.find((i) => i.key === POTION)!.id, 'eq:weapon');
    expect(inventory.takeFromInventory(POTION, 1).ok).toBe(true);
    expect(inventory.countItem(POTION)).toBe(0);
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });

  it('refuses to consume what the hero does not have', () => {
    const { inventory } = setup();
    const before = JSON.stringify(inventory.items);
    expect(inventory.takeFromInventory(POTION, 1).ok).toBe(false);
    expect(JSON.stringify(inventory.items)).toBe(before);
  });
});
