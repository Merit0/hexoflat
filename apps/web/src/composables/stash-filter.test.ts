import { describe, expect, it } from 'vitest';
import { getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import {
  HEXOBJECT_KEYS as K,
  type THexobjectKey,
} from '@hexoflat/engine/registry/hexobjects-registry';
import { isDimmed, STASH_FILTERS } from './stash-filter';

function item(key: THexobjectKey): InventoryItem {
  return { id: key, key, type: getPrototype(key).groupType, amount: 1, slotKey: 's', isNew: false };
}

describe('isDimmed', () => {
  it('offers five filters', () => {
    expect(STASH_FILTERS).toEqual(['all', 'gear', 'tool', 'resource', 'consumable']);
  });

  it('dims nothing for All and never dims an empty cell', () => {
    expect(isDimmed(item(K.SWORD), 'all')).toBe(false);
    expect(isDimmed(null, 'gear')).toBe(false);
  });

  it('dims what does not belong to the chosen category', () => {
    expect(isDimmed(item(K.SWORD), 'gear')).toBe(false);
    expect(isDimmed(item(K.AXE), 'gear')).toBe(true);
    expect(isDimmed(item(K.AXE), 'tool')).toBe(false);
    expect(isDimmed(item(K.COINS), 'resource')).toBe(false);
    expect(isDimmed(item(K.COINS), 'consumable')).toBe(true);
    expect(isDimmed(item(K.HEALTH_BOTTLE), 'consumable')).toBe(false);
    expect(isDimmed(item(K.HEALTH_BOTTLE), 'resource')).toBe(true);
  });
});
