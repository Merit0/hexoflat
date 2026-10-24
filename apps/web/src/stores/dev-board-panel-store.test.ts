import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDevBoardPanelStore } from './dev-board-panel-store';

describe('dev board panel collapse', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts collapsed so it does not cover the board, and toggles', () => {
    const store = useDevBoardPanelStore();

    expect(store.isCollapsed).toBe(true);
    store.toggleCollapsed();
    expect(store.isCollapsed).toBe(false);
    store.toggleCollapsed();
    expect(store.isCollapsed).toBe(true);
  });

  it('remembers the choice across a reload', () => {
    useDevBoardPanelStore().toggleCollapsed();

    setActivePinia(createPinia());

    expect(useDevBoardPanelStore().isCollapsed).toBe(false);
  });
});
