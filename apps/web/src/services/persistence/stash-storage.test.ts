import { beforeEach, describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { STASH_CAPACITY } from '@hexoflat/engine/inventory/stash-constants';
import { clearSavedStash, readSavedStash, writeSavedStash } from './stash-storage';

const KEY = 'hexoflat.hero.stash.v2';

function stored(id: string, key = 'coins', amount = 4) {
  return { id, key, type: 'loot', stackKey: key, amount, slotKey: 'stash:0', isNew: false };
}

function save(payload: object) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: 2, contentVersion: CONTENT_VERSION, ...payload }),
  );
}

describe('stash storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns nothing when no stash was saved', () => {
    expect(readSavedStash()).toBeNull();
  });

  it('round-trips the chests and cells and always returns all 210 cells', () => {
    const cells = [stored('a') as never, null, stored('b', 'health-bottle', 2) as never];
    writeSavedStash({ chests: 1, starterGiven: true, cells });
    const saved = readSavedStash();
    expect(saved?.chests).toBe(1);
    expect(saved?.cells).toHaveLength(STASH_CAPACITY);
    expect(saved?.cells[0]).toMatchObject({ id: 'a', key: 'coins', amount: 4 });
    expect(saved?.cells[1]).toBeNull();
    expect(saved?.cells[2]).toMatchObject({ id: 'b', amount: 2 });
  });

  it('keeps items that lie in a chest which is not unlocked yet', () => {
    const cells = Array.from({ length: 100 }, (_, i) => stored(`i-${i}`));
    save({ chests: 1, cells });
    const saved = readSavedStash();
    expect(saved?.cells.filter(Boolean)).toHaveLength(100);
    expect(saved?.cells[99]).not.toBeNull();
    expect(saved?.cells[100]).toBeNull();
  });

  it('turns broken, unknown or duplicate cells into empty ones instead of failing', () => {
    save({
      chests: 1,
      cells: [stored('a'), { nonsense: true }, stored('c', 'no-such-item'), stored('a'), null],
    });
    const read = readSavedStash();
    expect(read?.cells.map((cell) => cell?.id ?? null).slice(0, 5)).toEqual([
      'a',
      null,
      null,
      null,
      null,
    ]);
  });

  it('discards a payload that is corrupt, of another version, with a bad chest count or other content', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readSavedStash()).toBeNull();
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, contentVersion: CONTENT_VERSION, chests: 1, cells: [] }),
    );
    expect(readSavedStash()).toBeNull();
    save({ chests: 6, cells: [] });
    expect(readSavedStash()).toBeNull();
    save({ chests: -1, cells: [] });
    expect(readSavedStash()).toBeNull();
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, contentVersion: CONTENT_VERSION + 1, chests: 1, cells: [] }),
    );
    expect(readSavedStash()).toBeNull();
  });

  it('reads the starter flag, and treats a save from before the flag as not given yet', () => {
    writeSavedStash({ chests: 1, starterGiven: true, cells: [] });
    expect(readSavedStash()?.starterGiven).toBe(true);
    save({ chests: 1, cells: [] });
    expect(readSavedStash()?.starterGiven).toBe(false);
  });

  it('can be cleared', () => {
    writeSavedStash({ chests: 1, starterGiven: true, cells: [stored('a') as never] });
    clearSavedStash();
    expect(readSavedStash()).toBeNull();
  });
});
