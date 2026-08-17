import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { DiscoveryState } from '@hexoflat/engine';
import { buildFixtureMap, BROKEN_SPIRE_APPROACH_V1 } from '@hexoflat/engine';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { computeMapBounds, useHexBoardSizing } from '@/composables/use-hex-board-sizing';

/**
 * The board's bounds are the single most expensive silent regression in the
 * exploration slice, and the one no rendering test would catch. If `UNKNOWN`
 * hexes stay inside them, the frontier renders organically while the layout
 * is still the full technical rectangle: the camera centres on empty space
 * and the scale is computed for an area nobody can see. Nothing throws.
 *
 * So this file asserts the numbers directly, on both sides of the flag.
 */

const TILE_W = 100;
const TILE_H = 100;

function tile(columnIndex: number, rowIndex: number, discovery: DiscoveryState): IHexTile {
  return {
    tileId: `${columnIndex}:${rowIndex}`,
    hexBackgroundImagePath: '',
    discovery,
    get isRevealed() {
      return discovery !== 'UNKNOWN';
    },
    coordinates: { columnIndex, rowIndex },
    coordinatesToString: () => `${columnIndex},${rowIndex}`,
    hexobject: null,
    resourceSpawner: null,
    pendingAction: null,
  };
}

/** A 14x9 technical grid with a small known island in its top-left corner. */
function fixtureShapedGrid(): IHexTile[] {
  const known = new Set(['1:0', '2:0', '2:1', '3:1', '2:2']);
  const tiles: IHexTile[] = [];

  for (let rowIndex = 0; rowIndex < 9; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < 14; columnIndex += 1) {
      const isKnown = known.has(`${columnIndex}:${rowIndex}`);
      tiles.push(tile(columnIndex, rowIndex, isKnown ? 'DISCOVERED' : 'UNKNOWN'));
    }
  }

  return tiles;
}

describe('computeMapBounds', () => {
  it('spans exactly the tiles it is given', () => {
    const bounds = computeMapBounds(
      [tile(0, 0, 'DISCOVERED'), tile(1, 0, 'DISCOVERED')],
      TILE_W,
      TILE_H,
    );

    // Columns are 0.75 * width apart in odd-q flat-top; odd columns sit half
    // a tile lower. Two tiles therefore span 175px across and 150px down,
    // plus 2px of bleed on each side.
    expect(bounds.width).toBe(179);
    expect(bounds.height).toBe(154);
  });

  it('collapses to zero before the DOM probe has a real size', () => {
    expect(computeMapBounds([tile(0, 0, 'DISCOVERED')], 0, 0)).toEqual({
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('collapses to zero for an empty tile list', () => {
    expect(computeMapBounds([], TILE_W, TILE_H)).toEqual({
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe('useHexBoardSizing with the organic frontier on', () => {
  it('excludes UNKNOWN hexes from the board bounds', () => {
    const tiles = computed(() => fixtureShapedGrid());
    const sizing = useHexBoardSizing(tiles, ref(true));
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    const known = tiles.value.filter((t) => t.discovery !== 'UNKNOWN');

    expect(sizing.visibleTiles.value).toHaveLength(known.length);
    expect(sizing.mapBounds.value).toEqual(computeMapBounds(known, TILE_W, TILE_H));
  });

  it('is dramatically smaller than the technical rectangle', () => {
    const tiles = computed(() => fixtureShapedGrid());
    const sizing = useHexBoardSizing(tiles, ref(true));
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    const rectangle = computeMapBounds(tiles.value, TILE_W, TILE_H);

    expect(sizing.mapBounds.value.width).toBeLessThan(rectangle.width);
    expect(sizing.mapBounds.value.height).toBeLessThan(rectangle.height);
  });

  it('grows the bounds when a hex is discovered', () => {
    // The frontier moving has to move the board with it, or the newly known
    // hex renders outside the canvas.
    const grid = ref(fixtureShapedGrid());
    const sizing = useHexBoardSizing(
      computed(() => grid.value),
      ref(true),
    );
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    const before = sizing.mapBounds.value.width;
    grid.value = [...grid.value, tile(9, 4, 'OBSERVED')];

    expect(sizing.mapBounds.value.width).toBeGreaterThan(before);
  });

  it('counts OBSERVED as part of the board — only UNKNOWN is absent', () => {
    const tiles = computed(() => [tile(0, 0, 'DISCOVERED'), tile(1, 0, 'OBSERVED')]);
    const sizing = useHexBoardSizing(tiles, ref(true));
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    expect(sizing.visibleTiles.value).toHaveLength(2);
  });
});

describe('useHexBoardSizing with the organic frontier off', () => {
  it('keeps every tile, exactly as the pre-slice world maps expect', () => {
    // The existing FOG maps start every tile UNKNOWN. Filtering them here
    // would shrink the board to the hexes around the hero and grow it under
    // the player's feet as they explore — a regression the flag prevents.
    const tiles = computed(() => fixtureShapedGrid());
    const sizing = useHexBoardSizing(tiles);
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    expect(sizing.visibleTiles.value).toHaveLength(tiles.value.length);
    expect(sizing.mapBounds.value).toEqual(computeMapBounds(tiles.value, TILE_W, TILE_H));
  });

  it('sizes an all-UNKNOWN fogged map to the full grid', () => {
    const tiles = computed(() => [tile(0, 0, 'UNKNOWN'), tile(3, 2, 'UNKNOWN')]);
    const sizing = useHexBoardSizing(tiles);
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    expect(sizing.mapBounds.value.width).toBeGreaterThan(0);
    expect(sizing.mapBounds.value.height).toBeGreaterThan(0);
  });
});

describe('I3 — the contents of an UNKNOWN hex are unreachable from the view model', () => {
  it('keeps a hidden hexobject out of everything the renderer is handed', () => {
    // Honest scope: in solo the engine state lives in this same browser, so
    // this is enforced at the view-model boundary rather than cryptographically
    // — a server-side filter is a co-op question, not this phase's. What is
    // enforceable here is that nothing downstream of `visibleTiles` can reach
    // an unknown hex's contents, and that is what this pins.
    const map = buildFixtureMap(BROKEN_SPIRE_APPROACH_V1);
    const spire = { columnIndex: 9, rowIndex: 4 };
    const hidden = map.getTileAt(spire);
    if (!hidden) throw new Error('fixture is missing the Spire hex');
    hidden.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETOR, spire);

    const sizing = useHexBoardSizing(
      computed(() => map.tiles as unknown as IHexTile[]),
      ref(true),
    );
    sizing.domTileW.value = TILE_W;
    sizing.domTileH.value = TILE_H;

    expect(hidden.discovery).toBe('UNKNOWN');
    expect(
      sizing.visibleTiles.value.some(
        (t) =>
          t.coordinates.columnIndex === spire.columnIndex &&
          t.coordinates.rowIndex === spire.rowIndex,
      ),
    ).toBe(false);
    expect(JSON.stringify(sizing.visibleTiles.value.map((t) => t.hexobject))).not.toContain(
      HEXOBJECT_KEYS.SKELETOR,
    );
  });
});
