import { describe, expect, it } from 'vitest';
import { getMeta } from '../content/content-accessors';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { BAG_CAPACITY, BAG_SLOT_KEYS, BAG_WILL_SLOT_KEY, bagIndexOfSlotKey } from './bag-layout';
import {
  createInventoryState,
  emptyInventoryState,
  inventoryStateSchema,
  STARTER_SCROLL_COUNT,
} from './inventory-state';
import { STARTER_STASH_ITEMS } from './stash-constants';

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
    expect(inventoryStateSchema.safeParse(createInventoryState('h1')).success).toBe(true);
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
    const base = createInventoryState('h1');
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

describe('createInventoryState', () => {
  it('gives 50 Return Scrolls at the end of the bag and the starter gear in the first chest', () => {
    const state = createInventoryState('h1');
    const scrolls = state.bag.filter((item) => item?.key === HEXOBJECT_KEYS.RETURN_SCROLL);
    const total = scrolls.reduce((sum, item) => sum + (item?.amount ?? 0), 0);
    expect(total).toBe(STARTER_SCROLL_COUNT);
    const maxStack =
      getMeta(HEXOBJECT_KEYS.RETURN_SCROLL)?.traits?.maxStack ?? STARTER_SCROLL_COUNT;
    const stacks = Math.ceil(STARTER_SCROLL_COUNT / maxStack);
    expect(state.bag.slice(-stacks).every((item) => item !== null)).toBe(true);
    expect(state.bag.slice(0, BAG_CAPACITY - stacks).every((item) => item === null)).toBe(true);

    expect(state.stash.cells.slice(0, STARTER_STASH_ITEMS.length).map((c) => c?.key)).toEqual([
      ...STARTER_STASH_ITEMS,
    ]);
    expect(state.stash.chests).toBe(0);
    expect(state.stash.starterGiven).toBe(true);
    expect(Object.values(state.equip).every((slot) => slot === null)).toBe(true);
    expect(state.capacityKg).toBe(10);
  });

  it('is deterministic: ids come from idSeq, not from randomness', () => {
    const a = createInventoryState('h1');
    const b = createInventoryState('h1');
    expect(a).toEqual(b);
    expect(a.bag.at(-1)?.id).toMatch(/^h1:\d+$/);
    expect(a.idSeq).toBeGreaterThan(0);
  });
});
