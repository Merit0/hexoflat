import { describe, expect, it } from 'vitest';
import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import {
  HEXOBJECT_KEYS as K,
  type THexobjectKey,
} from '@hexoflat/engine/registry/hexobjects-registry';
import { BAG_SLOT_KEYS } from '@hexoflat/engine/inventory/bag-layout';
import { equipSlotKeyOf, toAggregate } from './inventory-aggregate';

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

const keys = [...BAG_SLOT_KEYS];

describe('toAggregate', () => {
  it('reads items by cell and treats a bare hand as an empty slot', () => {
    const items = [item(K.COINS, 'r0c2', 5), item(K.SWORD, 'eq:weapon'), item(K.HAND, 'eq:shield')];
    const agg = toAggregate(items, [], keys);
    expect(agg.bag[keys.indexOf('r0c2')]?.key).toBe(K.COINS);
    expect(agg.equip.weapon?.key).toBe(K.SWORD);
    expect(agg.equip.shield).toBeNull();
  });

  it('leaves out an item that sits on the Will cell, which has no bag index', () => {
    const agg = toAggregate([item(K.COINS, 'r0c0', 1, 'stray')], [], keys);
    expect(agg.bag.every((cell) => cell === null)).toBe(true);
  });

  it('names the slot key of a hand', () => {
    expect(equipSlotKeyOf('weapon')).toBe('eq:weapon');
  });
});
