import { describe, expect, it } from 'vitest';
import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import {
  HEXOBJECT_KEYS as K,
  type THexobjectKey,
} from '@hexoflat/engine/registry/hexobjects-registry';
import { bagSlotKeys, equipSlotKeyOf, fromAggregate, toAggregate } from './inventory-aggregate';

const GRID = { cols: 12, rows: 7, blockedRect: { x: 3, y: 1, w: 6, h: 5 } };
const WILL = 'r0c0';

function item(key: THexobjectKey, slotKey: string, amount = 1, id = `${key}@${slotKey}`) {
  const stackable = !!getMeta(key)?.traits?.stackable;
  const built: InventoryItem = {
    id,
    key,
    type: getPrototype(key).groupType,
    stackKey: stackable ? key : undefined,
    amount,
    slotKey,
    isNew: false,
  };
  return built;
}

const hands = () => [item(K.HAND, 'eq:weapon'), item(K.HAND, 'eq:shield')];

describe('bagSlotKeys', () => {
  const keys = bagSlotKeys(GRID, WILL);

  it('lists every free cell of the grid once, row by row', () => {
    expect(keys).toHaveLength(12 * 7 - 6 * 5 - 1);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe('r0c1');
  });

  it('leaves out the Will slot and the cells under the equipment board', () => {
    expect(keys).not.toContain(WILL);
    expect(keys).not.toContain('r1c3');
    expect(keys).not.toContain('r5c8');
    expect(keys).toContain('r1c2');
    expect(keys).toContain('r6c3');
  });
});

describe('toAggregate / fromAggregate', () => {
  const keys = bagSlotKeys(GRID, WILL);

  it('reads items by cell and treats a bare hand as an empty slot', () => {
    const items = [item(K.COINS, 'r0c2', 5), item(K.SWORD, 'eq:weapon'), item(K.HAND, 'eq:shield')];
    const agg = toAggregate(items, [], keys);
    expect(agg.bag[keys.indexOf('r0c2')]?.key).toBe(K.COINS);
    expect(agg.equip.weapon?.key).toBe(K.SWORD);
    expect(agg.equip.shield).toBeNull();
  });

  it('gives back the same items with the same cells when nothing changed', () => {
    const items = [item(K.COINS, 'r0c2', 5), item(K.SWORD, 'eq:weapon'), item(K.HAND, 'eq:shield')];
    const back = fromAggregate(toAggregate(items, [], keys), items, keys);
    const sorted = (list: InventoryItem[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(sorted(back.items)).toEqual(sorted(items));
  });

  it('writes the slot key of the new cell on every moved item', () => {
    const items = [item(K.COINS, 'r0c2', 5, 'coins'), ...hands()];
    const agg = toAggregate(items, [], keys);
    const moved = { ...agg, bag: agg.bag.map(() => null), stash: [agg.bag[keys.indexOf('r0c2')]] };
    const back = fromAggregate(moved, items, keys);
    expect(back.items.some((i) => i.id === 'coins')).toBe(false);
    expect(back.stash[0]).toMatchObject({ id: 'coins', slotKey: 'stash:0' });
  });

  it('keeps the bare hand when its slot stays empty and drops it when the slot is filled', () => {
    const items = [item(K.HAND, 'eq:weapon', 1, 'hand-w'), item(K.HAND, 'eq:shield', 1, 'hand-s')];
    const agg = toAggregate(items, [], keys);
    const filled = { ...agg, equip: { ...agg.equip, weapon: item(K.AXE, 'x', 1, 'axe') } };
    const back = fromAggregate(filled, items, keys);
    expect(back.items.map((i) => i.id).sort()).toEqual(['axe', 'hand-s']);
    expect(back.items.find((i) => i.id === 'axe')?.slotKey).toBe(equipSlotKeyOf('weapon'));
  });

  it('does not lose an item sitting on a cell the aggregate never addresses', () => {
    const stray = item(K.COINS, WILL, 1, 'stray');
    const items = [stray, ...hands()];
    const back = fromAggregate(toAggregate(items, [], keys), items, keys);
    expect(back.items.map((i) => i.id)).toContain('stray');
  });
});
