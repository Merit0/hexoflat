import { describe, expect, it } from 'vitest';
import { resolveDropTarget } from './stash-drop-target';

function el(data: Record<string, string>): HTMLElement {
  const node = document.createElement('div');
  Object.assign(node.dataset, data);
  return node;
}

describe('resolveDropTarget', () => {
  it('reads a bag or stash cell by container and index', () => {
    expect(resolveDropTarget([el({ dropContainer: 'bag', dropIndex: '3' })])).toEqual({
      kind: 'cell',
      at: { container: 'bag', index: 3 },
    });
    expect(resolveDropTarget([el({ dropContainer: 'stash', dropIndex: '40' })])).toEqual({
      kind: 'cell',
      at: { container: 'stash', index: 40 },
    });
  });

  it('reads an equipment slot', () => {
    expect(resolveDropTarget([el({ dropContainer: 'equip', dropSlot: 'weapon' })])).toEqual({
      kind: 'cell',
      at: { container: 'equip', slot: 'weapon' },
    });
  });

  it('prefers the cell over the pane that holds it', () => {
    const target = resolveDropTarget([
      el({ zone: 'stash' }),
      el({ dropContainer: 'stash', dropIndex: '1' }),
    ]);
    expect(target?.kind).toBe('cell');
  });

  it('falls back to the pane when the pointer is between cells', () => {
    expect(resolveDropTarget([el({ zone: 'bag' })])).toEqual({ kind: 'zone', container: 'bag' });
  });

  it('ignores anything that is not a drop place', () => {
    expect(resolveDropTarget([el({})])).toBeNull();
    expect(resolveDropTarget([])).toBeNull();
    expect(resolveDropTarget([el({ dropContainer: 'equip', dropSlot: 'tail' })])).toBeNull();
    expect(resolveDropTarget([el({ dropContainer: 'stash', dropIndex: 'x' })])).toBeNull();
    expect(resolveDropTarget([el({ zone: 'elsewhere' })])).toBeNull();
  });
});
