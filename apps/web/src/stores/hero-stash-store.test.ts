import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { STASH_CAPACITY } from '@hexoflat/engine/inventory/stash-constants';
import { readSavedStash } from '@/services/persistence/stash-storage';
import { useHeroStashStore } from './hero-stash-store';

const coins = (id: string, slot: number) =>
  ({
    id,
    key: 'coins',
    type: 'loot',
    stackKey: 'coins',
    amount: 9,
    slotKey: `stash:${slot}`,
    isNew: false,
  }) as never;

describe('useHeroStashStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('starts closed with no chest bought and no open cell', () => {
    const stash = useHeroStashStore();
    expect(stash.chests).toBe(0);
    expect(stash.capacity).toBe(0);
    expect(stash.ownedCells).toHaveLength(0);
    expect(stash.cells).toHaveLength(STASH_CAPACITY);
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

  it('opens 42 cells per bought chest, never more than five chests', () => {
    const stash = useHeroStashStore();
    stash.setChests(2);
    expect(stash.capacity).toBe(84);
    expect(stash.ownedCells).toHaveLength(84);
    stash.setChests(99);
    expect(stash.chests).toBe(5);
    expect(stash.capacity).toBe(210);
    stash.setChests(-3);
    expect(stash.chests).toBe(0);
  });

  it('remembers the chest on view and keeps it inside the chests that exist after a reopen', () => {
    const stash = useHeroStashStore();
    stash.setChests(2);
    stash.selectChest(1);
    expect(stash.preferredRange).toEqual({ start: 42, end: 84 });
    stash.selectChest(9);
    expect(stash.activeChest).toBe(4);
    stash.close();
    stash.open();
    expect(stash.activeChest).toBe(1);
  });

  it('saves the chests and cells and gets them back after a reload', () => {
    const first = useHeroStashStore();
    first.starterGiven = true;
    first.setChests(1);
    const cells = first.ownedCells.slice();
    cells[3] = coins('coin-stack', 3);
    first.replaceOwnedCells(cells);
    expect(readSavedStash()?.cells[3]?.amount).toBe(9);

    setActivePinia(createPinia());
    const reloaded = useHeroStashStore();
    reloaded.hydrate();
    expect(reloaded.chests).toBe(1);
    expect(reloaded.cells[3]).toMatchObject({ id: 'coin-stack', amount: 9 });
    expect(reloaded.usedCount).toBe(1);
  });

  it('counts only what sits in the open chests', () => {
    const stash = useHeroStashStore();
    stash.starterGiven = true;
    stash.setChests(1);
    const cells = stash.cells.slice();
    cells[1] = coins('inside', 1);
    cells[100] = coins('outside', 100);
    stash.replaceOwnedCells(cells);
    expect(stash.usedCount).toBe(1);
  });

  describe('the starter gear', () => {
    it('lies in the first chest of a new hero, hidden while that chest is locked', () => {
      const stash = useHeroStashStore();
      stash.hydrate();
      expect(stash.chests).toBe(0);
      expect(stash.ownedCells).toHaveLength(0);
      expect(stash.usedCount).toBe(0);
      expect(stash.cells.slice(0, 5).map((cell) => cell?.key ?? null)).toEqual([
        'sword',
        'axe',
        'shield',
        'pickaxe',
        null,
      ]);
    });

    it('shows up once the first chest is unlocked', () => {
      const stash = useHeroStashStore();
      stash.hydrate();
      stash.setChests(1);
      expect(stash.ownedCells.slice(0, 4).map((cell) => cell?.key)).toEqual([
        'sword',
        'axe',
        'shield',
        'pickaxe',
      ]);
      expect(stash.usedCount).toBe(4);
    });

    it('is given once: it survives a reload with the same items, and an emptied stash stays empty', () => {
      const first = useHeroStashStore();
      first.hydrate();
      const ids = first.cells.slice(0, 4).map((cell) => cell?.id);

      setActivePinia(createPinia());
      const reloaded = useHeroStashStore();
      reloaded.hydrate();
      expect(reloaded.cells.slice(0, 4).map((cell) => cell?.id)).toEqual(ids);

      reloaded.setChests(1);
      reloaded.replaceOwnedCells(reloaded.ownedCells.map(() => null));
      setActivePinia(createPinia());
      const again = useHeroStashStore();
      again.hydrate();
      expect(again.usedCount).toBe(0);
    });

    it('is also given once to a stash saved before the gear existed, into the free cells of the first chest', () => {
      const old = useHeroStashStore();
      old.starterGiven = true;
      old.setChests(1);
      const cells = old.ownedCells.slice();
      cells[0] = coins('mine', 0);
      old.replaceOwnedCells(cells);
      localStorage.setItem(
        'hexoflat.hero.stash.v2',
        JSON.stringify({
          version: 2,
          contentVersion: CONTENT_VERSION,
          chests: 1,
          cells: old.cells,
        }),
      );

      setActivePinia(createPinia());
      const reloaded = useHeroStashStore();
      reloaded.hydrate();

      expect(reloaded.chests).toBe(1);
      expect(reloaded.ownedCells.slice(0, 5).map((cell) => cell?.key ?? null)).toEqual([
        'coins',
        'sword',
        'axe',
        'shield',
        'pickaxe',
      ]);
    });

    it('is not given again after the hero took it out', () => {
      const first = useHeroStashStore();
      first.hydrate();
      first.setChests(1);
      first.replaceOwnedCells(first.ownedCells.map(() => null));

      setActivePinia(createPinia());
      const again = useHeroStashStore();
      again.hydrate();
      again.hydrate();
      expect(again.usedCount).toBe(0);
    });
  });
});
