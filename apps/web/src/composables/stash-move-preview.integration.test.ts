import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { openStashBoard } from '@/composables/use-stash-board';
import { useMovePreview } from '@/composables/use-move-preview';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';

const START = { columnIndex: 0, rowIndex: 0 };
const FAR = { columnIndex: 2, rowIndex: 0 };

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  const world = useWorldMapStore();
  const hero = useHeroStore();
  hero.hero.id = 'hero-1';
  const map = new HexMapBuilder().name('preview-test').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  world.map = map;
  world.currentMapId = 'preview-test-map';
  hero.heroCoordinates = { ...START };
  const hovered = ref<{ columnIndex: number; rowIndex: number } | null>(FAR);
  const preview = useMovePreview({
    hoveredTileCoord: hovered,
    getTileByCoord: (coord) =>
      map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === coord.columnIndex &&
          t.coordinates.rowIndex === coord.rowIndex,
      ),
  });
  return { preview, tool: useHeroToolStore() };
}

describe('the walking route preview (real stores, no mocks)', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('shows the route when no tool is active', () => {
    ctx.tool.stopTool();
    expect(ctx.preview.segments.value.length).toBeGreaterThan(0);
  });

  it('hides the route while a tool is active and the stash is closed', () => {
    ctx.tool.useTool(K.HAND, START);
    expect(ctx.preview.segments.value).toHaveLength(0);
  });

  it('shows the route while the stash is open, because the hero can walk away from it', () => {
    ctx.tool.useTool(K.HAND, START);
    openStashBoard();
    expect(ctx.preview.segments.value.length).toBeGreaterThan(0);
    expect(ctx.preview.markerCoord.value).toEqual(FAR);
  });
});
