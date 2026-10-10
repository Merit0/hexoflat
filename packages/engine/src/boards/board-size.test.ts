import { describe, expect, it } from 'vitest';
import { BOARD_CELL_COUNT, BOARD_COLUMNS, BOARD_ROWS } from './board-size';

describe('board size constants', () => {
  it('are positive integers', () => {
    expect(Number.isInteger(BOARD_COLUMNS)).toBe(true);
    expect(Number.isInteger(BOARD_ROWS)).toBe(true);
    expect(BOARD_COLUMNS).toBeGreaterThan(0);
    expect(BOARD_ROWS).toBeGreaterThan(0);
  });

  it('BOARD_CELL_COUNT is the product of columns and rows', () => {
    expect(BOARD_CELL_COUNT).toBe(BOARD_COLUMNS * BOARD_ROWS);
  });
});
