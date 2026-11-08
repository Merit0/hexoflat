import { describe, expect, it } from 'vitest';
import type { TTransferResult } from '@hexoflat/engine/inventory/item-transfer';
import { describeDrop } from './stash-drop-label';
import type { StashDropTarget } from './stash-drag-state';

const cell: StashDropTarget = { kind: 'cell', at: { container: 'stash', index: 0 } };
const done = (kind: 'move' | 'swap' | 'merge' | 'split' | 'equip' | 'noop', moved = 1) =>
  ({ ok: true, kind, moved, next: {} as never }) as TTransferResult;

describe('describeDrop', () => {
  it('shows nothing without a target or a plan', () => {
    expect(describeDrop(null, cell)).toBeNull();
    expect(describeDrop(done('move'), null)).toBeNull();
  });

  it('names what a drop on a cell does, with the amount for stacks, and says nothing about a plain move', () => {
    expect(describeDrop(done('move'), cell)).toBeNull();
    expect(describeDrop(done('swap'), cell)?.id).toBe('swap');
    expect(describeDrop(done('equip'), cell)?.id).toBe('equip');
    expect(describeDrop(done('merge', 3), cell)).toEqual({ id: 'merge', tone: 'ok', count: 3 });
    expect(describeDrop(done('split', 4), cell)).toEqual({ id: 'split', tone: 'ok', count: 4 });
  });

  it('names the destination when the pointer is over a pane', () => {
    const toBag: StashDropTarget = { kind: 'zone', container: 'bag' };
    const toStash: StashDropTarget = { kind: 'zone', container: 'stash' };
    expect(describeDrop(done('move'), toBag)?.id).toBe('toBag');
    expect(describeDrop(done('move'), toStash)?.id).toBe('toStash');
  });

  it('says it cannot be dropped when the plan is refused', () => {
    const refused: TTransferResult = { ok: false, reason: 'WRONG_SLOT' };
    expect(describeDrop(refused, cell)).toEqual({ id: 'cant', tone: 'bad', count: 0 });
  });

  it('stays silent for a drop on the same cell', () => {
    expect(describeDrop(done('noop', 0), cell)).toBeNull();
  });
});
