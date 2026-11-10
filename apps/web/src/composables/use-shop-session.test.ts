import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { isHeroBoardOpen } from '@/composables/use-hero-board-collapse';
import { knowledgePanelMode, openKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useTraderStore } from '@/stores/trader-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { closeHeroOverlays } from '@/services/squads/close-hero-overlays';
import { openStashBoard } from './use-stash-board';
import { closeShopBoard, openShopBoard } from './use-shop-board';
import { useShopSession } from './use-shop-session';

let app: App;

function mountSession() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const Probe = defineComponent({
    setup() {
      useShopSession();
      return () => null;
    },
  });
  app = createApp(Probe).use(pinia);
  app.mount(document.createElement('div'));
}

const shopOpen = () => useTraderStore().isOpen;

describe('useShopSession', () => {
  beforeEach(async () => {
    knowledgePanelMode.value = null;
    isHeroBoardOpen.value = false;
    mountSession();
    useHeroStore().heroCoordinates = { columnIndex: 9, rowIndex: 8 };
    await nextTick();
    openShopBoard('ilva');
    await nextTick();
  });
  afterEach(() => app.unmount());

  it('opens the board of that trader and unfolds the hero panel', () => {
    expect(useTraderStore().traderKey).toBe('ilva');
    expect(isHeroBoardOpen.value).toBe(true);
  });

  it('closes with the close action', () => {
    closeShopBoard();
    expect(shopOpen()).toBe(false);
  });

  it('closes when the hero walks to another hex', async () => {
    useHeroStore().heroCoordinates = { columnIndex: 9, rowIndex: 9 };
    await nextTick();
    expect(shopOpen()).toBe(false);
  });

  it('does not close for a new coordinates object on the same hex', async () => {
    useHeroStore().heroCoordinates = { columnIndex: 9, rowIndex: 8 };
    await nextTick();
    expect(shopOpen()).toBe(true);
  });

  it('closes when the hero changes location', async () => {
    useWorldMapStore().currentLocationKey = 'cave';
    await nextTick();
    expect(shopOpen()).toBe(false);
  });

  it('closes when a battle starts', async () => {
    useBattleStore().engagement = {} as never;
    await nextTick();
    expect(shopOpen()).toBe(false);
  });

  it('closes when the Book of Will opens', async () => {
    openKnowledgePanel('hall');
    await nextTick();
    expect(shopOpen()).toBe(false);
  });

  it('closes when the stash opens', async () => {
    await openStashBoard();
    await nextTick();
    expect(shopOpen()).toBe(false);
    expect(useHeroStashStore().isOpen).toBe(true);
  });

  it('closes with the other hero overlays', () => {
    closeHeroOverlays();
    expect(shopOpen()).toBe(false);
  });

  it('closes on Escape and ignores other keys', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(shopOpen()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shopOpen()).toBe(false);
  });
});

describe('openShopBoard keeps the boards apart', () => {
  beforeEach(() => {
    knowledgePanelMode.value = null;
    mountSession();
  });
  afterEach(() => app.unmount());

  it('closes the open stash', async () => {
    await openStashBoard();
    openShopBoard('ilva');
    await nextTick();
    expect(useHeroStashStore().isOpen).toBe(false);
    expect(shopOpen()).toBe(true);
  });

  it('closes the Book of Will and stays open itself', async () => {
    openKnowledgePanel('hall');
    await nextTick();
    openShopBoard('ilva');
    await nextTick();
    expect(knowledgePanelMode.value).toBeNull();
    expect(shopOpen()).toBe(true);
  });
});
