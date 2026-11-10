import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { BAG_CAPACITY, BAG_SLOT_KEYS, BAG_WILL_SLOT_KEY, bagIndexOfSlotKey } from './bag-layout';
import { emptyInventoryState, inventoryStateSchema } from './inventory-state';

describe('bag layout', () => {
  it('has 53 addressable cells without the Will cell and the blocked centre', () => {
    expect(BAG_CAPACITY).toBe(53);
    expect(BAG_SLOT_KEYS).not.toContain(BAG_WILL_SLOT_KEY);
    expect(BAG_SLOT_KEYS).not.toContain('r2c4');
    expect(bagIndexOfSlotKey('r0c1')).toBe(0);
    expect(bagIndexOfSlotKey('nope')).toBe(-1);
  });
});

describe('InventoryState schema', () => {
  it('accepts an empty and a fresh state', () => {
    expect(inventoryStateSchema.safeParse(emptyInventoryState('h1')).success).toBe(true);
    expect(inventoryStateSchema.safeParse(emptyInventoryState('h1')).success).toBe(true);
  });

  it('fills the defaults for revision, capacity and idSeq', () => {
    const { revision, capacityKg, idSeq, ...rest } = emptyInventoryState('h1');
    void revision;
    void capacityKg;
    void idSeq;
    const parsed = inventoryStateSchema.parse(rest);
    expect(parsed.revision).toBe(0);
    expect(parsed.capacityKg).toBe(10);
    expect(parsed.idSeq).toBe(0);
  });

  it('rejects a wrong bag length, an unknown key, a bad amount and a repeated id', () => {
    const base = emptyInventoryState('h1');
    expect(inventoryStateSchema.safeParse({ ...base, bag: base.bag.slice(1) }).success).toBe(false);

    const item = { id: 'x', key: HEXOBJECT_KEYS.SWORD, type: 'tool', amount: 1 };
    const withItem = (patch: object) => {
      const bag = base.bag.map(() => null) as unknown[];
      bag[0] = { ...item, ...patch };
      return inventoryStateSchema.safeParse({ ...base, bag }).success;
    };
    expect(withItem({ key: 'no-such-key' })).toBe(false);
    expect(withItem({ amount: 0 })).toBe(false);

    const twice = base.bag.map(() => null) as unknown[];
    twice[0] = item;
    twice[1] = item;
    expect(inventoryStateSchema.safeParse({ ...base, bag: twice }).success).toBe(false);
  });
});

describe('emptyInventoryState', () => {
  it('is a hero with nothing: empty bag, hands and stash, no chest unlocked, no coins', () => {
    const state = emptyInventoryState('h1');
    expect(state.bag.every((cell) => cell === null)).toBe(true);
    expect(state.stash.cells.every((cell) => cell === null)).toBe(true);
    expect(state.stash.chests).toBe(0);
    expect(Object.values(state.equip).every((slot) => slot === null)).toBe(true);
    expect(state.idSeq).toBe(0);
    expect(state.revision).toBe(0);
    expect(state.capacityKg).toBe(10);
  });

  it('is deterministic', () => {
    expect(emptyInventoryState('h1')).toEqual(emptyInventoryState('h1'));
  });
});
