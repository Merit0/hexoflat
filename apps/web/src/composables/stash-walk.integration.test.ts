import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { openStashBoard } from '@/composables/use-stash-board';
import { useTileClick } from '@/composables/use-tile-click';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { seedFakeSession } from '@/test-support/fake-session';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);

const START = { columnIndex: 0, rowIndex: 0 };
const TARGET = { columnIndex: 1, rowIndex: 0 };

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  knowledgePanelMode.value = null;
  const world = useWorldMapStore();
  const hero = useHeroStore();
  hero.hero.id = 'hero-1';
  seedFakeSession('hero-1');
  hero.loadKnowledge();
  const map = new HexMapBuilder().name('walk-test').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  world.map = map;
  world.currentMapId = 'walk-test-map';
  hero.heroCoordinates = { ...START };
  const target = map.tiles.find(
    (t) =>
      t.coordinates.columnIndex === TARGET.columnIndex &&
      t.coordinates.rowIndex === TARGET.rowIndex,
  ) as IHexTile;
  return { hero, tool: useHeroToolStore(), stash: useHeroStashStore(), target };
}

describe('walking with the hand tool working on the stash chest (no mocks)', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
    ctx.tool.useTool(K.HAND, START);
  });

  it('keeps standing while a tool is active and the stash is closed', async () => {
    await useTileClick().handleTileClick(ctx.target);
    expect(ctx.hero.heroCoordinates).toEqual(START);
  });

  it('walks to the clicked hex while the stash is open', async () => {
    await openStashBoard();
    expect(ctx.stash.isOpen).toBe(true);

    await useTileClick().handleTileClick(ctx.target);

    expect(ctx.hero.heroCoordinates).toEqual(TARGET);
  });

  it('closes the stash and stops the tool when the hero walks away', async () => {
    await openStashBoard();

    await useTileClick().handleTileClick(ctx.target);

    expect(ctx.stash.isOpen).toBe(false);
    expect(ctx.tool.isDragging).toBe(false);
    expect(ctx.tool.activeTool).toBeNull();
  });
});
