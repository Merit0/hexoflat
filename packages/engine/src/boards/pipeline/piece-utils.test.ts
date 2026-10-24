import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../utils/random-seeded';
import { BoardCellMap } from '../board-cell-map';
import { BoardTrace } from './trace';
import { inFrame, intBetween, isFloor, shuffled } from './piece-utils';
import type { BoardDraft } from './types';

function draft(): BoardDraft {
  const cellMap = new BoardCellMap();
  cellMap.set({ columnIndex: 0, rowIndex: 0 }, { exists: true });
  cellMap.set({ columnIndex: 1, rowIndex: 0 }, { exists: true, terrain: 'water' });
  cellMap.set(
    { columnIndex: 2, rowIndex: 0 },
    { exists: true, hexobject: { hexobjectKey: 'stone-wall' } },
  );
  return {
    frame: { columns: 3, rows: 2 },
    background: '',
    cellMap,
    regions: [],
    links: [],
    trace: new BoardTrace(),
  };
}

describe('piece utils', () => {
  it('intBetween stays inside the inclusive range', () => {
    const rng = deriveStream('utils', 'int');
    const seen = new Set(Array.from({ length: 200 }, () => intBetween(2, 4, rng)));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('shuffled keeps every item, leaves the input untouched and is seed-stable', () => {
    const items = [1, 2, 3, 4, 5];
    const first = shuffled(items, deriveStream('utils', 'shuffle'));
    const again = shuffled(items, deriveStream('utils', 'shuffle'));

    expect([...first].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(again).toEqual(first);
  });

  it('inFrame and isFloor read the draft frame and cells', () => {
    const board = draft();

    expect(inFrame(board, { columnIndex: 2, rowIndex: 1 })).toBe(true);
    expect(inFrame(board, { columnIndex: 3, rowIndex: 0 })).toBe(false);
    expect(inFrame(board, { columnIndex: -1, rowIndex: 0 })).toBe(false);
    expect(isFloor(board, { columnIndex: 0, rowIndex: 0 })).toBe(true);
    expect(isFloor(board, { columnIndex: 1, rowIndex: 0 })).toBe(false);
    expect(isFloor(board, { columnIndex: 2, rowIndex: 0 })).toBe(false);
    expect(isFloor(board, { columnIndex: 0, rowIndex: 1 })).toBe(false);
  });
});
