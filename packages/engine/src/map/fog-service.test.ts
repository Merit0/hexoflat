import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import { coordinateKey } from '../utils/hex-utils';
import {
  getTileVisibility,
  initFog,
  revealAroundHero,
  revealEntryTile,
  revealTileNextToHero,
  selectVisibleTiles,
} from './fog-service';

function buildMap(width = 5, height = 5) {
  const map = new HexMapBuilder().name('fog-test').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = false;
  return map;
}

describe('initFog', () => {
  it('hides every tile when the map has no ALL_REVEALED policy', () => {
    const map = buildMap();
    for (const tile of map.tiles) tile.isRevealed = true;

    initFog(map);

    expect(map.tiles.every((tile) => !tile.isRevealed)).toBe(true);
  });

  it('reveals every tile when the policy says so', () => {
    const map = buildMap();
    map.fogPolicy = 'ALL_REVEALED';

    initFog(map);

    expect(map.tiles.every((tile) => tile.isRevealed)).toBe(true);
  });

  it('reports every tile as touched, so the renderer redraws the whole map', () => {
    const map = buildMap(3, 3);

    expect(initFog(map)).toHaveLength(map.tiles.length);
  });
});

describe('revealAroundHero', () => {
  it('reveals the hero tile and its neighbours, and nothing else', () => {
    const map = buildMap();
    const hero = { columnIndex: 2, rowIndex: 2 };

    const revealed = revealAroundHero(map, hero);

    const revealedKeys = new Set(revealed.map(coordinateKey));
    expect(revealedKeys.has(coordinateKey(hero))).toBe(true);
    expect(revealed.length).toBeLessThan(map.tiles.length);
    for (const tile of map.tiles) {
      expect(tile.isRevealed).toBe(revealedKeys.has(coordinateKey(tile.coordinates)));
    }
  });

  it('only reports tiles that exist, so a corner hero reveals fewer', () => {
    const map = buildMap();

    const corner = revealAroundHero(map, { columnIndex: 0, rowIndex: 0 });
    const middle = revealAroundHero(map, { columnIndex: 2, rowIndex: 2 });

    expect(corner.length).toBeLessThan(middle.length);
  });

  it('returns nothing when the hero stands off the map', () => {
    const map = buildMap();

    expect(revealAroundHero(map, { columnIndex: 99, rowIndex: 99 })).toEqual([]);
  });
});

describe('revealTileNextToHero', () => {
  const hero = { columnIndex: 2, rowIndex: 2 };

  it('reveals a hidden neighbour and reports it', () => {
    const map = buildMap();
    const neighbor = { columnIndex: 2, rowIndex: 1 };

    const revealed = revealTileNextToHero(map, hero, neighbor);

    expect(revealed).not.toBeNull();
    expect(
      map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(neighbor))!.isRevealed,
    ).toBe(true);
  });

  it('refuses a tile that is not adjacent to the hero', () => {
    const map = buildMap();

    expect(revealTileNextToHero(map, hero, { columnIndex: 0, rowIndex: 0 })).toBeNull();
  });

  it("refuses the hero's own tile", () => {
    const map = buildMap();

    expect(revealTileNextToHero(map, hero, hero)).toBeNull();
  });

  it('returns null for an already-revealed tile, so no redundant save happens', () => {
    const map = buildMap();
    const neighbor = { columnIndex: 2, rowIndex: 1 };
    revealTileNextToHero(map, hero, neighbor);

    expect(revealTileNextToHero(map, hero, neighbor)).toBeNull();
  });

  it('returns null for a tile that is not on the map', () => {
    const map = buildMap();

    expect(revealTileNextToHero(map, hero, { columnIndex: 99, rowIndex: 99 })).toBeNull();
  });
});

describe('revealEntryTile', () => {
  it('returns null when the map declares no entry placement', () => {
    const map = buildMap();
    map.config = [];

    expect(revealEntryTile(map)).toBeNull();
  });

  it('reveals the DEFAULT entrance in preference to a SECRET one', () => {
    const map = buildMap();
    const secret = { columnIndex: 0, rowIndex: 0 };
    const primary = { columnIndex: 1, rowIndex: 1 };
    map.config = [
      { coordinates: [secret], entry: { type: 'SECRET' } },
      { coordinates: [primary], entry: { type: 'DEFAULT' } },
    ] as typeof map.config;

    expect(revealEntryTile(map)).toEqual(primary);
  });

  it('falls back to the SECRET entrance when there is no DEFAULT one', () => {
    const map = buildMap();
    const secret = { columnIndex: 0, rowIndex: 1 };
    map.config = [{ coordinates: [secret], entry: { type: 'SECRET' } }] as typeof map.config;

    expect(revealEntryTile(map)).toEqual(secret);
  });
});

describe('getTileVisibility', () => {
  it('is KNOWN for a revealed tile', () => {
    const map = buildMap();
    const hero = { columnIndex: 2, rowIndex: 2 };
    revealAroundHero(map, hero);

    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(hero))!;

    expect(getTileVisibility(map, tile)).toBe('KNOWN');
  });

  it('is GHOST_FRONTIER for a hidden tile next to a revealed one', () => {
    const map = buildMap();
    revealAroundHero(map, { columnIndex: 2, rowIndex: 2 });

    const ghost = map.tiles.find(
      (t) => !t.isRevealed && getTileVisibility(map, t) === 'GHOST_FRONTIER',
    );

    expect(ghost).toBeDefined();
  });

  it('is null (Deep Unknown) for a hidden tile with no revealed neighbour', () => {
    const map = buildMap(7, 7);
    revealAroundHero(map, { columnIndex: 0, rowIndex: 0 });

    const farTile = map.tiles.find(
      (t) => coordinateKey(t.coordinates) === coordinateKey({ columnIndex: 6, rowIndex: 6 }),
    )!;

    expect(getTileVisibility(map, farTile)).toBeNull();
  });
});

describe('selectVisibleTiles', () => {
  it('returns only KNOWN and GHOST_FRONTIER tiles, never Deep Unknown', () => {
    const map = buildMap(7, 7);
    revealAroundHero(map, { columnIndex: 0, rowIndex: 0 });

    const visible = selectVisibleTiles(map);

    expect(visible.length).toBeLessThan(map.tiles.length);
    for (const tile of visible) {
      expect(getTileVisibility(map, tile)).not.toBeNull();
    }
  });

  it('includes every revealed tile', () => {
    const map = buildMap();
    revealAroundHero(map, { columnIndex: 2, rowIndex: 2 });

    const visibleKeys = new Set(selectVisibleTiles(map).map((t) => coordinateKey(t.coordinates)));

    for (const tile of map.tiles.filter((t) => t.isRevealed)) {
      expect(visibleKeys.has(coordinateKey(tile.coordinates))).toBe(true);
    }
  });
});
