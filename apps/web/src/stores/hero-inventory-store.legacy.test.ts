import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getMeta } from '@hexoflat/engine';
import { useHeroInventoryStore, WILL_SLOT_KEY } from './hero-inventory-store';

const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;
const SWORD = HEXOBJECT_KEYS.SWORD;

function freshStore() {
  setActivePinia(createPinia());
  localStorage.clear();
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  return inventory;
}

describe('legacy inventory characterization: applyMoveToSlot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('replaces the placeholder hand with the moved item and refills the vacated slot', () => {
    const inventory = freshStore();
    inventory.putToInventory(SWORD, 1);
    const sword = inventory.items.find((i) => i.key === SWORD)!;
    const handBefore = inventory.equippedItems.weapon!;

    inventory.moveItemToSlot(sword.id, 'eq:weapon');

    expect(inventory.equippedItems.weapon?.id).toBe(sword.id);
    expect(inventory.items.some((i) => i.id === handBefore.id)).toBe(false);
    expect(inventory.equippedItems.shield?.key).toBe(HEXOBJECT_KEYS.HAND);
  });

  it('moves into an empty bag cell', () => {
    const inventory = freshStore();
    inventory.putToInventory(SWORD, 1);
    const sword = inventory.items.find((i) => i.key === SWORD)!;
    const target = inventory.freeSlotKeys[0];

    inventory.moveItemToSlot(sword.id, target);

    expect(inventory.itemsBySlot[target]?.id).toBe(sword.id);
  });

  it('swaps two bag items', () => {
    const inventory = freshStore();
    inventory.putToInventory(SWORD, 1);
    inventory.putToInventory(HEXOBJECT_KEYS.SHIELD, 1);
    const a = inventory.items.find((i) => i.key === SWORD)!;
    const b = inventory.items.find((i) => i.key === HEXOBJECT_KEYS.SHIELD)!;
    const slotA = a.slotKey;
    const slotB = b.slotKey;

    inventory.moveItemToSlot(a.id, slotB);

    expect(inventory.items.find((i) => i.id === a.id)?.slotKey).toBe(slotB);
    expect(inventory.items.find((i) => i.id === b.id)?.slotKey).toBe(slotA);
  });

  it('merges stacks of the same item in the bag and removes the emptied source', () => {
    const inventory = freshStore();
    const maxStack = getMeta(POTION)?.traits?.maxStack ?? 99;
    inventory.putToInventory(POTION, 1);
    const first = inventory.items.find((i) => i.key === POTION)!;
    inventory.items.push({
      ...first,
      id: 'second-potion',
      amount: 1,
      slotKey: inventory.freeSlotKeys[0],
    });

    inventory.moveItemToSlot('second-potion', first.slotKey);

    const potions = inventory.items.filter((i) => i.key === POTION);
    expect(potions).toHaveLength(1);
    expect(potions[0].amount).toBe(Math.min(2, maxStack));
  });

  it('never moves a hand placeholder and never drops onto the Will cell', () => {
    const inventory = freshStore();
    const hand = inventory.equippedItems.weapon!;
    const free = inventory.freeSlotKeys[0];
    inventory.moveItemToSlot(hand.id, free);
    expect(inventory.equippedItems.weapon?.id).toBe(hand.id);

    inventory.putToInventory(SWORD, 1);
    const sword = inventory.items.find((i) => i.key === SWORD)!;
    const slot = sword.slotKey;
    inventory.moveItemToSlot(sword.id, WILL_SLOT_KEY);
    expect(inventory.items.find((i) => i.id === sword.id)?.slotKey).toBe(slot);
  });

  it('ignores a move onto its own cell and an unknown id', () => {
    const inventory = freshStore();
    inventory.putToInventory(SWORD, 1);
    const sword = inventory.items.find((i) => i.key === SWORD)!;
    const before = JSON.stringify(inventory.items);

    inventory.moveItemToSlot(sword.id, sword.slotKey);
    inventory.moveItemToSlot('nope', inventory.freeSlotKeys[0]);

    expect(JSON.stringify(inventory.items)).toBe(before);
  });

  it('does not check slot compatibility (legacy; the engine plan does)', () => {
    const inventory = freshStore();
    inventory.putToInventory(POTION, 1);
    const potion = inventory.items.find((i) => i.key === POTION)!;

    inventory.moveItemToSlot(potion.id, 'eq:helm');

    expect(inventory.equippedItems.helm?.id).toBe(potion.id);
  });
});

describe('legacy inventory characterization: putToInventory', () => {
  it('refuses the hand and throws on an unknown key (the engine grant must reject instead)', () => {
    const inventory = freshStore();
    expect(inventory.putToInventory(HEXOBJECT_KEYS.HAND).ok).toBe(false);
    expect(() => inventory.putToInventory('no-such-key' as never)).toThrow(/Unknown Hexobject key/);
  });

  it('merges into an existing stack and sets isNew', () => {
    const inventory = freshStore();
    inventory.putToInventory(POTION, 1);
    inventory.putToInventory(POTION, 1);

    const potions = inventory.items.filter((i) => i.key === POTION);
    expect(potions).toHaveLength(1);
    expect(potions[0].amount).toBe(2);
    expect(potions[0].isNew).toBe(true);
  });

  it('refuses when the incoming weight exceeds the carry limit and changes nothing', () => {
    const inventory = freshStore();
    inventory.carryCapacityKg = 0;
    const before = JSON.stringify(inventory.items);

    const result = inventory.putToInventory(SWORD, 1);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(inventory.items)).toBe(before);
  });

  it('places a new item on a free bag cell, never the Will cell or the blocked centre', () => {
    const inventory = freshStore();
    inventory.putToInventory(SWORD, 1);
    const sword = inventory.items.find((i) => i.key === SWORD)!;

    expect(sword.slotKey).not.toBe(WILL_SLOT_KEY);
    expect(sword.slotKey.startsWith('eq:')).toBe(false);
    const [, r, c] = /^r(\d+)c(\d+)$/.exec(sword.slotKey)!.map(Number);
    expect(inventory.isCellBlocked(r, c)).toBe(false);
  });

  it('answers "Inventory is full!" when no cell is free', () => {
    const inventory = freshStore();
    for (const slotKey of inventory.freeSlotKeys) {
      inventory.items.push({
        id: `fill-${slotKey}`,
        key: SWORD,
        type: EHexobjectGroup.TOOL,
        amount: 1,
        slotKey,
        isNew: false,
      });
    }
    inventory.carryCapacityKg = 10_000;

    expect(inventory.putToInventory(SWORD, 1)).toEqual({
      ok: false,
      message: 'Inventory is full!',
    });
  });
});

describe('legacy inventory characterization: hydrate', () => {
  it('moves an item sitting on the Will cell to the first free cell', () => {
    setActivePinia(createPinia());
    localStorage.clear();
    const seeded = useHeroInventoryStore();
    seeded.hydrate();
    seeded.items.push({
      id: 'squatter',
      key: SWORD,
      type: EHexobjectGroup.TOOL,
      amount: 1,
      slotKey: WILL_SLOT_KEY,
      isNew: false,
    });
    seeded.persist();

    setActivePinia(createPinia());
    const reloaded = useHeroInventoryStore();
    reloaded.hydrate();

    const squatter = reloaded.items.find((i) => i.id === 'squatter')!;
    expect(squatter.slotKey).not.toBe(WILL_SLOT_KEY);
  });

  it('fills both empty hands on a fresh start', () => {
    const inventory = freshStore();
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
    expect(inventory.equippedItems.shield?.key).toBe(HEXOBJECT_KEYS.HAND);
  });
});
