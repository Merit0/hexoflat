import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { STASH_CAPACITY } from '@hexoflat/engine/inventory/stash-constants';
import { readSavedStash } from '@/services/persistence/stash-storage';
import { useHeroStashStore } from './hero-stash-store';

describe('useHeroStashStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('starts empty, closed and the size of the camp stash', () => {
    const stash = useHeroStashStore();
    expect(stash.capacity).toBe(STASH_CAPACITY);
    expect(stash.usedCount).toBe(0);
    expect(stash.isOpen).toBe(false);
  });

  it('opens and closes without touching the cells', () => {
    const stash = useHeroStashStore();
    stash.open();
    expect(stash.isOpen).toBe(true);
    stash.close();
    expect(stash.isOpen).toBe(false);
  });

  it('saves replaced cells and gets them back after a reload', () => {
    const first = useHeroStashStore();
    const cells = first.cells.slice();
    cells[3] = {
      id: 'coin-stack',
      key: 'coins',
      type: 'loot',
      stackKey: 'coins',
      amount: 9,
      slotKey: 'stash:3',
      isNew: false,
    } as never;
    first.replaceCells(cells);
    expect(readSavedStash()?.[3]?.amount).toBe(9);

    setActivePinia(createPinia());
    const reloaded = useHeroStashStore();
    reloaded.hydrate();
    expect(reloaded.cells[3]).toMatchObject({ id: 'coin-stack', amount: 9 });
    expect(reloaded.usedCount).toBe(1);
  });
});
