import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { BAG_CAPACITY, BAG_SLOT_KEYS } from './bag-layout';
import { inventoryStateSchema } from './inventory-state';
import { migrateLegacyInventory, type LegacyStash } from './inventory-migration';
import { STARTER_STASH_ITEMS, STASH_CAPACITY } from './stash-constants';

function item(id: string, key: THexobjectKey, slotKey: string, amount = 1): InventoryItem {
  return { id, key, type: EHexobjectGroup.TOOL, amount, slotKey, isNew: true };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function stashWith(
  cells: Record<number, InventoryItem>,
  overrides: Partial<LegacyStash> = {},
): LegacyStash {
  return {
    chests: 1,
    starterGiven: true,
    cells: Array.from({ length: STASH_CAPACITY }, (_, i) => cells[i] ?? null),
    ...overrides,
  };
}

describe('migrateLegacyInventory', () => {
  it('nothing saved: the same start as a new hero (scrolls and starter gear)', () => {
    const { state, overflow } = migrateLegacyInventory('h1', null, null);
    expect(overflow).toEqual([]);
    expect(state.bag.some((c) => c?.key === HEXOBJECT_KEYS.RETURN_SCROLL)).toBe(true);
    expect(state.stash.cells[0]?.key).toBe(STARTER_STASH_ITEMS[0]);
    expect(inventoryStateSchema.safeParse(state).success).toBe(true);
  });

  it('a saved empty bag gets no scrolls (they are granted once)', () => {
    const { state } = migrateLegacyInventory('h1', { items: [] }, stashWith({}));
    expect(state.bag.every((c) => c === null)).toBe(true);
    expect(state.stash.starterGiven).toBe(true);
    expect(state.stash.cells.every((c) => c === null)).toBe(true);
  });

  it('maps rXcY to bag indexes, eq:<slot> to equip and drops the hand placeholders', () => {
    const legacy = {
      items: [
        item('a', HEXOBJECT_KEYS.SWORD, 'r0c1'),
        item('b', HEXOBJECT_KEYS.SHIELD, 'eq:shield'),
        item('hand', HEXOBJECT_KEYS.HAND, 'eq:weapon'),
      ],
      carryCapacityKg: 12,
    };
    const { state } = migrateLegacyInventory('h1', legacy, stashWith({}));
    expect(state.bag[BAG_SLOT_KEYS.indexOf('r0c1')]?.id).toBe('a');
    expect(state.equip.shield?.id).toBe('b');
    expect(state.equip.weapon).toBeNull();
    expect(state.capacityKg).toBe(12);
    expect(state.bag[0]).toMatchObject({ key: HEXOBJECT_KEYS.SWORD });
    expect(state.bag[0]).not.toHaveProperty('slotKey');
    expect(state.bag[0]).not.toHaveProperty('isNew');
  });

  it('moves an item from the Will cell, a blocked cell or a taken cell to the first free cell', () => {
    const legacy = {
      items: [
        item('a', HEXOBJECT_KEYS.SWORD, 'r0c1'),
        item('will', HEXOBJECT_KEYS.AXE, 'r0c0'),
        item('blocked', HEXOBJECT_KEYS.PICKAXE, 'r2c4'),
        item('clash', HEXOBJECT_KEYS.SHIELD, 'r0c1'),
      ],
    };
    const { state, overflow } = migrateLegacyInventory('h1', legacy, stashWith({}));
    expect(overflow).toEqual([]);
    const ids = state.bag.filter(Boolean).map((c) => c!.id);
    expect(ids.sort()).toEqual(['a', 'blocked', 'clash', 'will']);
    expect(state.bag[0]?.id).toBe('a');
  });

  it('keeps stash cells, chests and the starter flag; grants the gear when it was never given', () => {
    const kept = migrateLegacyInventory(
      'h1',
      { items: [] },
      stashWith({ 5: item('s', HEXOBJECT_KEYS.SWORD, 'stash:5') }, { chests: 2 }),
    );
    expect(kept.state.stash.chests).toBe(2);
    expect(kept.state.stash.cells[5]?.id).toBe('s');

    const fresh = migrateLegacyInventory(
      'h1',
      { items: [] },
      stashWith({}, { starterGiven: false }),
    );
    expect(fresh.state.stash.starterGiven).toBe(true);
    expect(fresh.state.stash.cells[0]?.key).toBe(STARTER_STASH_ITEMS[0]);
  });

  it('discards corrupt items, unknown keys and repeated ids instead of throwing', () => {
    const legacy = {
      items: [
        item('ok', HEXOBJECT_KEYS.SWORD, 'r0c1'),
        item('ok', HEXOBJECT_KEYS.AXE, 'r0c2'),
        item('bad-amount', HEXOBJECT_KEYS.AXE, 'r0c3', 0),
        item('bad-key', 'ghost' as THexobjectKey, 'r0c4'),
      ],
    };
    const { state } = migrateLegacyInventory('h1', legacy, stashWith({}));
    expect(state.bag.filter(Boolean).map((c) => c!.id)).toEqual(['ok']);
    expect(inventoryStateSchema.safeParse(state).success).toBe(true);
  });

  it('keeps an item that exists both in the bag and the stash only once', () => {
    const { state } = migrateLegacyInventory(
      'h1',
      { items: [item('dup', HEXOBJECT_KEYS.SWORD, 'r0c1')] },
      stashWith({ 0: item('dup', HEXOBJECT_KEYS.SWORD, 'stash:0') }),
    );
    const all = [...state.bag, ...state.stash.cells].filter(Boolean);
    expect(all.filter((c) => c!.id === 'dup')).toHaveLength(1);
  });

  it('reports what fitted nowhere instead of losing it silently', () => {
    const full = BAG_SLOT_KEYS.map((key, i) => item(`f${i}`, HEXOBJECT_KEYS.SWORD, key));
    const legacy = { items: [...full, item('extra', HEXOBJECT_KEYS.AXE, 'r0c0')] };
    const { state, overflow } = migrateLegacyInventory('h1', legacy, stashWith({}, { chests: 0 }));
    expect(state.bag.filter(Boolean)).toHaveLength(BAG_CAPACITY);
    expect(overflow.map((o) => o.id)).toEqual(['extra']);
  });

  it('uses an open chest cell before reporting overflow', () => {
    const full = BAG_SLOT_KEYS.map((key, i) => item(`f${i}`, HEXOBJECT_KEYS.SWORD, key));
    const legacy = { items: [...full, item('extra', HEXOBJECT_KEYS.AXE, 'r0c0')] };
    const { state, overflow } = migrateLegacyInventory('h1', legacy, stashWith({}));
    expect(overflow).toEqual([]);
    expect(state.stash.cells.some((c) => c?.id === 'extra')).toBe(true);
  });

  it('does not change its input', () => {
    const legacy = deepFreeze({ items: [item('a', HEXOBJECT_KEYS.SWORD, 'r0c0')] });
    const stash = deepFreeze(stashWith({ 0: item('s', HEXOBJECT_KEYS.AXE, 'stash:0') }));
    expect(() => migrateLegacyInventory('h1', legacy, stash)).not.toThrow();
  });
});
