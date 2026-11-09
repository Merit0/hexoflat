import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import {
  clearInventoryRecord,
  patchInventoryRecord,
  readInventoryRecord,
} from './inventory-record-storage';
import { readSavedInventory, writeSavedInventory } from './inventory-storage';
import { readSavedStash, writeSavedStash } from './stash-storage';

const RECORD_KEY = 'hexoflat:inventory:v2:hero';

function item(id: string, slotKey: string): InventoryItem {
  return {
    id,
    key: HEXOBJECT_KEYS.COINS,
    type: EHexobjectGroup.LOOT,
    amount: 3,
    slotKey,
    isNew: false,
  };
}

describe('inventory record storage', () => {
  beforeEach(() => localStorage.clear());

  it('reads nothing when nothing was ever saved', () => {
    expect(readInventoryRecord()).toEqual({ bag: null, stash: null });
    expect(localStorage.getItem(RECORD_KEY)).toBeNull();
  });

  it('moves the old bag and stash keys into one record and removes them afterwards', () => {
    writeSavedInventory({
      items: [item('b', 'r0c1')],
      rotationsById: { b: 4 },
      carryCapacityKg: 12,
    });
    writeSavedStash({ chests: 2, starterGiven: true, cells: [item('s', 'stash:0')] });

    const record = readInventoryRecord();

    expect(record.bag).toMatchObject({ carryCapacityKg: 12, rotationsById: { b: 4 } });
    expect(record.bag?.items.map((i) => i.id)).toEqual(['b']);
    expect(record.stash).toMatchObject({ chests: 2, starterGiven: true });
    expect(record.stash?.cells[0]?.id).toBe('s');
    expect(localStorage.getItem(RECORD_KEY)).not.toBeNull();
    expect(readSavedInventory()).toBeNull();
    expect(readSavedStash()).toBeNull();
    expect(readInventoryRecord()).toEqual(record);
  });

  it('migrates a lone bag save and leaves the stash empty', () => {
    writeSavedInventory({ items: [], rotationsById: {}, carryCapacityKg: 10 });
    const record = readInventoryRecord();
    expect(record.bag).not.toBeNull();
    expect(record.stash).toBeNull();
  });

  it('keeps the old keys when the new record cannot be written', () => {
    writeSavedInventory({ items: [item('b', 'r0c1')], rotationsById: {}, carryCapacityKg: 10 });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    const record = readInventoryRecord();
    setItem.mockRestore();
    errorSpy.mockRestore();

    expect(record.bag?.items).toHaveLength(1);
    expect(readSavedInventory()?.items).toHaveLength(1);
  });

  it('writes the bag and the stash in one setItem and keeps the part it was not given', () => {
    patchInventoryRecord({ stash: { chests: 1, starterGiven: true, cells: [] } });
    patchInventoryRecord({
      bag: { items: [item('b', 'r0c1')], rotationsById: {}, carryCapacityKg: 9 },
    });
    const record = readInventoryRecord();
    expect(record.stash?.chests).toBe(1);
    expect(record.bag?.carryCapacityKg).toBe(9);

    const setItem = vi.spyOn(localStorage, 'setItem');
    patchInventoryRecord({
      bag: { items: [], rotationsById: {}, carryCapacityKg: 9 },
      stash: { chests: 2, starterGiven: true, cells: [] },
    });
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it('discards a corrupt or foreign record instead of throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(RECORD_KEY, '{not json');
    expect(readInventoryRecord()).toEqual({ bag: null, stash: null });
    localStorage.setItem(RECORD_KEY, JSON.stringify({ version: 9, bag: {}, stash: {} }));
    expect(readInventoryRecord()).toEqual({ bag: null, stash: null });
    errorSpy.mockRestore();
  });

  it('clearing removes the record and the old keys', () => {
    writeSavedInventory({ items: [], rotationsById: {}, carryCapacityKg: 10 });
    patchInventoryRecord({ stash: { chests: 1, starterGiven: true, cells: [] } });
    clearInventoryRecord();
    expect(localStorage.getItem(RECORD_KEY)).toBeNull();
    expect(readSavedInventory()).toBeNull();
    expect(readInventoryRecord()).toEqual({ bag: null, stash: null });
  });
});
