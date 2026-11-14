import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginQuestPress, consumeQuestDragClick, questDrag, targetOf } from './use-quest-drag';

function fire(type: string, x: number, y: number, init: PointerEventInit = {}) {
  window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, ...init }));
}

function stubGroup(group: 'active' | 'available' | null) {
  const element = document.createElement('div');
  if (group) element.setAttribute('data-quest-group', group);
  document.elementFromPoint = vi.fn(() => element);
}

function press(from: 'active' | 'available', onDrop = vi.fn()) {
  beginQuestPress(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }), {
    questId: 'woodcutter',
    label: 'Woodcutter',
    from,
    onDrop,
  });
  return onDrop;
}

describe('quest drag between sections', () => {
  afterEach(() => {
    fire('pointercancel', 0, 0);
    consumeQuestDragClick();
  });

  it('targets the other section', () => {
    expect(targetOf('available')).toBe('active');
    expect(targetOf('active')).toBe('available');
  });

  it('does nothing for a click that stays under the threshold', () => {
    const onDrop = press('available');
    fire('pointermove', 2, 1);
    fire('pointerup', 2, 1);
    expect(questDrag.active).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
    expect(consumeQuestDragClick()).toBe(false);
  });

  it('drops into the other section and swallows the click that follows', () => {
    stubGroup('active');
    const onDrop = press('available');
    fire('pointermove', 30, 30);
    expect(questDrag.active).toBe(true);
    expect(questDrag.over).toBe('active');
    fire('pointerup', 30, 30);
    expect(onDrop).toHaveBeenCalledWith('active');
    expect(questDrag.active).toBe(false);
    expect(consumeQuestDragClick()).toBe(true);
  });

  it('ignores a drop on the section it came from or on empty space', () => {
    stubGroup('available');
    const same = press('available');
    fire('pointermove', 30, 30);
    fire('pointerup', 30, 30);
    expect(same).not.toHaveBeenCalled();

    stubGroup(null);
    const outside = press('active');
    fire('pointermove', 30, 30);
    fire('pointerup', 30, 30);
    expect(outside).not.toHaveBeenCalled();
  });

  it('cancels on Escape without dropping', () => {
    stubGroup('available');
    const onDrop = press('active');
    fire('pointermove', 30, 30);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fire('pointerup', 30, 30);
    expect(onDrop).not.toHaveBeenCalled();
    expect(questDrag.active).toBe(false);
  });
});
