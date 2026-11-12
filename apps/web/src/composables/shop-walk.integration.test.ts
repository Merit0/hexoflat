import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { openShopBoard } from '@/composables/use-shop-board';
import { useTileClick } from '@/composables/use-tile-click';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { holdLocalWorld, seedFakeSession } from '@/test-support/fake-session';

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
  holdLocalWorld({
    locationKey: world.currentLocationKey,
    mapId: 'walk-test-map',
    map,
    heroCoordinates: hero.heroCoordinates,
  });
  const target = map.tiles.find(
    (t) =>
      t.coordinates.columnIndex === TARGET.columnIndex &&
      t.coordinates.rowIndex === TARGET.rowIndex,
  ) as IHexTile;
  return { hero, tool: useHeroToolStore(), trader: useTraderStore(), target };
}

describe('walking with the hand tool working on the trader stall (no mocks)', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
    ctx.tool.useTool(K.HAND, START);
  });

  it('walks to the clicked hex while the shop is open', async () => {
    openShopBoard('ilva');
    expect(ctx.trader.isOpen).toBe(true);

    await useTileClick().handleTileClick(ctx.target);

    expect(ctx.hero.heroCoordinates).toEqual(TARGET);
  });

  it('closes the shop and stops the tool when the hero walks away', async () => {
    openShopBoard('ilva');

    await useTileClick().handleTileClick(ctx.target);

    expect(ctx.trader.isOpen).toBe(false);
    expect(ctx.tool.isDragging).toBe(false);
    expect(ctx.tool.activeTool).toBeNull();
  });
});
