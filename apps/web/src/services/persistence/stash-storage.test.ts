import { beforeEach, describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { STASH_CAPACITY } from '@hexoflat/engine/inventory/stash-constants';
import { clearSavedStash, readSavedStash, writeSavedStash } from './stash-storage';

const KEY = 'hexoflat.hero.stash.v1';

function stored(id: string, key = 'coins', amount = 4) {
  return { id, key, type: 'loot', stackKey: key, amount, slotKey: 'stash:0', isNew: false };
}

describe('stash storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns nothing when no stash was saved', () => {
    expect(readSavedStash()).toBeNull();
  });

  it('round-trips the cells and always returns a full-size stash', () => {
    writeSavedStash([stored('a') as never, null, stored('b', 'health-bottle', 2) as never]);
    const cells = readSavedStash();
    expect(cells).toHaveLength(STASH_CAPACITY);
    expect(cells?.[0]).toMatchObject({ id: 'a', key: 'coins', amount: 4 });
    expect(cells?.[1]).toBeNull();
    expect(cells?.[2]).toMatchObject({ id: 'b', amount: 2 });
  });

  it('turns broken, unknown or duplicate cells into empty ones instead of failing', () => {
    const cells = [stored('a'), { nonsense: true }, stored('c', 'no-such-item'), stored('a'), null];
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, contentVersion: CONTENT_VERSION, cells }),
    );
    const read = readSavedStash();
    expect(read?.map((cell) => cell?.id ?? null).slice(0, 5)).toEqual([
      'a',
      null,
      null,
      null,
      null,
    ]);
  });

  it('discards a payload that is corrupt, of another version, or of other content', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readSavedStash()).toBeNull();
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, contentVersion: CONTENT_VERSION, cells: [] }),
    );
    expect(readSavedStash()).toBeNull();
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, contentVersion: CONTENT_VERSION + 1, cells: [] }),
    );
    expect(readSavedStash()).toBeNull();
  });

  it('can be cleared', () => {
    writeSavedStash([stored('a') as never]);
    clearSavedStash();
    expect(readSavedStash()).toBeNull();
  });
});
