import { describe, expect, it } from 'vitest';
import { TileDirtyTracker } from './tile-dirty-tracker';

// No Pinia, no jsdom, no store — the point of pulling this out of
// world-map-store.ts is that render bookkeeping is testable on its own.

describe('TileDirtyTracker', () => {
  it('marks a single tile without touching any other', () => {
    const tracker = new TileDirtyTracker();

    tracker.add({ columnIndex: 3, rowIndex: 4 });

    expect(tracker.consume()).toEqual(new Set(['3:4']));
  });

  it('deduplicates repeated marks of the same tile', () => {
    const tracker = new TileDirtyTracker();

    tracker.add({ columnIndex: 1, rowIndex: 1 });
    tracker.add({ columnIndex: 1, rowIndex: 1 });

    expect(tracker.size).toBe(1);
  });

  it('consume() drains the set, so a second read is empty', () => {
    const tracker = new TileDirtyTracker();
    tracker.add({ columnIndex: 0, rowIndex: 0 });

    tracker.consume();

    expect(tracker.consume().size).toBe(0);
  });

  it('returns a snapshot that later mutations cannot change', () => {
    const tracker = new TileDirtyTracker();
    tracker.add({ columnIndex: 0, rowIndex: 0 });

    const drained = tracker.consume();
    tracker.add({ columnIndex: 9, rowIndex: 9 });

    expect(drained).toEqual(new Set(['0:0']));
  });

  it('addMany is a no-op for an empty list', () => {
    const tracker = new TileDirtyTracker();

    tracker.addMany([]);

    expect(tracker.size).toBe(0);
  });

  it('addMany marks every coordinate it is given', () => {
    const tracker = new TileDirtyTracker();

    tracker.addMany([
      { columnIndex: 0, rowIndex: 0 },
      { columnIndex: 1, rowIndex: 2 },
    ]);

    expect(tracker.consume()).toEqual(new Set(['0:0', '1:2']));
  });
});
