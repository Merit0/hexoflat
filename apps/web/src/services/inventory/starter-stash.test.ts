import { describe, expect, it } from 'vitest';
import { emptyStash } from '@hexoflat/engine/inventory/stash-state';
import { grantStarterGear } from './starter-stash';

const keys = (cells: ReturnType<typeof grantStarterGear>, count = 8) =>
  cells.slice(0, count).map((cell) => cell?.key ?? null);

describe('grantStarterGear', () => {
  it('puts the four pieces in the first cells of an empty stash', () => {
    const cells = grantStarterGear(emptyStash().cells);
    expect(keys(cells)).toEqual(['sword', 'axe', 'shield', 'pickaxe', null, null, null, null]);
    expect(cells[2]?.slotKey).toBe('stash:2');
    expect(new Set(cells.filter(Boolean).map((cell) => cell?.id)).size).toBe(4);
  });

  it('never overwrites what is already there and takes the next free cells', () => {
    const base = emptyStash().cells;
    base[1] = {
      id: 'mine',
      key: 'coins',
      type: 'loot',
      amount: 5,
      slotKey: 'stash:1',
      isNew: false,
    } as never;
    const cells = grantStarterGear(base);
    expect(cells[1]?.id).toBe('mine');
    expect(keys(cells, 6)).toEqual(['sword', 'coins', 'axe', 'shield', 'pickaxe', null]);
  });

  it('leaves a piece out when the first chest has no free cell left', () => {
    const base = emptyStash().cells;
    for (let i = 0; i < 41; i += 1) {
      base[i] = {
        id: `f-${i}`,
        key: 'coins',
        type: 'loot',
        amount: 1,
        slotKey: `stash:${i}`,
        isNew: false,
      } as never;
    }
    const cells = grantStarterGear(base);
    expect(cells[41]?.key).toBe('sword');
    expect(cells.slice(42).every((cell) => cell === null)).toBe(true);
  });

  it('does not change the cells it was given', () => {
    const base = emptyStash().cells;
    grantStarterGear(base);
    expect(base.every((cell) => cell === null)).toBe(true);
  });
});
