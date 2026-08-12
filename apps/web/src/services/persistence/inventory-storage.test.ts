import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { clearSavedInventory, readSavedInventory, writeSavedInventory } from './inventory-storage';

const STORAGE_KEY = 'hexoflat.hero.inventory.v1';

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    key: HEXOBJECT_KEYS.COINS,
    type: EHexobjectGroup.LOOT,
    amount: 1,
    slotKey: 'r0c0',
    isNew: false,
    ...overrides,
  };
}

describe('inventory-storage (characterization)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been saved yet', () => {
    expect(readSavedInventory()).toBeNull();
  });

  it('round-trips items, rotations and carry capacity', () => {
    const items = [makeItem()];
    const rotationsById = { 'item-1': 7 };

    writeSavedInventory({ items, rotationsById, carryCapacityKg: 12 });
    const restored = readSavedInventory();

    expect(restored).toEqual({ items, rotationsById, carryCapacityKg: 12 });
  });

  it('writes under the versioned envelope the on-disk format expects', () => {
    writeSavedInventory({ items: [], rotationsById: {}, carryCapacityKg: 5 });

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;

    expect(raw.version).toBe(1);
    expect(raw.contentVersion).toBe(CONTENT_VERSION);
  });

  it('discards a saved inventory written by an older content version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        contentVersion: CONTENT_VERSION - 1,
        items: [makeItem()],
        rotationsById: {},
        carryCapacityKg: 5,
      }),
    );

    expect(readSavedInventory()).toBeNull();
  });

  it('discards a saved inventory written by an older format version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 0,
        contentVersion: CONTENT_VERSION,
        items: [],
        rotationsById: {},
        carryCapacityKg: 5,
      }),
    );

    expect(readSavedInventory()).toBeNull();
  });

  it('filters out items that do not look like a serializable InventoryItem', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        contentVersion: CONTENT_VERSION,
        items: [makeItem(), { id: 'broken' }],
        rotationsById: {},
        carryCapacityKg: 5,
      }),
    );

    expect(readSavedInventory()!.items).toEqual([makeItem()]);
  });

  it('defaults carry capacity to 5 when the saved value is not a number', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        contentVersion: CONTENT_VERSION,
        items: [],
        rotationsById: {},
        carryCapacityKg: 'a lot',
      }),
    );

    expect(readSavedInventory()!.carryCapacityKg).toBe(5);
  });

  it('returns null instead of throwing on unparsable JSON', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(readSavedInventory()).toBeNull();

    errorSpy.mockRestore();
  });

  it('clearSavedInventory removes the key entirely', () => {
    writeSavedInventory({ items: [], rotationsById: {}, carryCapacityKg: 5 });

    clearSavedInventory();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
