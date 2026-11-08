import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { openStashBoard } from './use-stash-board';
import { useStashSession } from './use-stash-session';

let app: App;

function mountSession() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const Probe = defineComponent({
    setup() {
      useStashSession();
      return () => null;
    },
  });
  app = createApp(Probe).use(pinia);
  app.mount(document.createElement('div'));
}

describe('useStashSession', () => {
  beforeEach(async () => {
    knowledgePanelMode.value = null;
    mountSession();
    useHeroStore().heroCoordinates = { columnIndex: 3, rowIndex: 4 };
    await nextTick();
    openStashBoard();
  });
  afterEach(() => app.unmount());

  it('stays open while nothing changes', async () => {
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(true);
  });

  it('closes when the hero walks to another hex', async () => {
    useHeroStore().heroCoordinates = { columnIndex: 3, rowIndex: 5 };
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(false);
  });

  it('does not close for a new coordinates object on the same hex', async () => {
    useHeroStore().heroCoordinates = { columnIndex: 3, rowIndex: 4 };
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(true);
  });

  it('closes when the hero changes location', async () => {
    useWorldMapStore().currentLocationKey = 'cave';
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(false);
  });

  it('closes when the Book of Will opens', async () => {
    knowledgePanelMode.value = 'hall';
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(false);
  });

  it('closes on Escape', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(useHeroStashStore().isOpen).toBe(false);
  });

  it('ignores other keys', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(useHeroStashStore().isOpen).toBe(true);
  });

  it('does not watch a battle that is not running', async () => {
    expect(useBattleStore().inBattle).toBe(false);
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(true);
  });
});
