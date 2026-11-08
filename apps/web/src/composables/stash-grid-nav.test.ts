import { describe, expect, it } from 'vitest';
import { isGridNavKey, nextCellIndex } from './stash-grid-nav';

describe('nextCellIndex in a grid of 7 columns and 53 cells', () => {
  it('moves one cell sideways and stops at the row ends', () => {
    expect(nextCellIndex(3, 'ArrowRight', 7, 53)).toBe(4);
    expect(nextCellIndex(3, 'ArrowLeft', 7, 53)).toBe(2);
    expect(nextCellIndex(6, 'ArrowRight', 7, 53)).toBeNull();
    expect(nextCellIndex(7, 'ArrowLeft', 7, 53)).toBeNull();
  });

  it('moves one row up and down and stops at the grid edges', () => {
    expect(nextCellIndex(3, 'ArrowDown', 7, 53)).toBe(10);
    expect(nextCellIndex(10, 'ArrowUp', 7, 53)).toBe(3);
    expect(nextCellIndex(3, 'ArrowUp', 7, 53)).toBeNull();
    expect(nextCellIndex(50, 'ArrowDown', 7, 53)).toBeNull();
  });

  it('does not run past the short last row', () => {
    expect(nextCellIndex(45, 'ArrowDown', 7, 53)).toBe(52);
    expect(nextCellIndex(46, 'ArrowDown', 7, 53)).toBeNull();
    expect(nextCellIndex(52, 'ArrowRight', 7, 53)).toBeNull();
  });

  it('jumps to the first and the last cell', () => {
    expect(nextCellIndex(20, 'Home', 7, 53)).toBe(0);
    expect(nextCellIndex(20, 'End', 7, 53)).toBe(52);
    expect(nextCellIndex(0, 'Home', 7, 0)).toBeNull();
  });

  it('knows which keys it handles', () => {
    expect(isGridNavKey('ArrowUp')).toBe(true);
    expect(isGridNavKey('Enter')).toBe(false);
  });
});
