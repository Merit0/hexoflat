import HexMapModel from '../../map/models/hex-map-model';
import { HexTileBuilder } from '../../map/builders/hex-tile-builder';
import { Complexity } from '../../enums/complexity';
import { coordinateKey } from '../../utils/hex-utils';
import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import type { FixtureHex, WorldFixture } from './world-fixture-schema';

/**
 * Turns an authored fixture into a runtime `HexMapModel`.
 *
 * Two things happen here and nowhere else:
 *
 * 1. The **technical grid** is generated at its full declared size, every hex
 *    `UNKNOWN`. Those surplus hexes exist so the frontier has room to grow;
 *    they are never drawn, because `UNKNOWN` gets no sprite and is excluded
 *    from the board's bounds.
 * 2. The **world-entry state** from the fixture is stamped onto the authored
 *    hexes (design §8, brief block 4). This is authored data, not a runtime
 *    rule: the Camp is `UNDERSTOOD` because the fixture says so, not because
 *    something computed it at load.
 *
 * Terrain and traversal deliberately do **not** land on the tiles. They are
 * static content and stay in the fixture, reachable via `getFixtureHexAt` —
 * rule #3 keeps content out of runtime state, and nothing in E1 consumes
 * them at runtime. E3 is where traversal starts changing during play and
 * therefore needs a runtime home; it does not have one yet on purpose.
 *
 * Do not call `initFog` on the result: it would flatten every authored state
 * back to the boolean's two values and erase the Camp's `UNDERSTOOD`.
 */
export function buildFixtureMap(fixture: WorldFixture): HexMapModel {
  const map = new HexMapModel();

  map.name = fixture.fixtureId;
  map.width = fixture.grid.width;
  map.height = fixture.grid.height;
  map.complexity = Complexity.NORMAL;
  map.config = [];
  map.fogPolicy = 'FOG';

  const tiles = [];
  for (let rowIndex = 0; rowIndex < fixture.grid.height; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < fixture.grid.width; columnIndex += 1) {
      const tile = new HexTileBuilder()
        .coordinates({ columnIndex, rowIndex })
        .discovery('UNKNOWN')
        .build();
      tile.tileId = `${columnIndex}:${rowIndex}`;
      tiles.push(tile);
    }
  }
  map.tiles = tiles;

  for (const hex of fixture.hexes) {
    const tile = map.getTileAt(hex.coordinates);
    if (!tile) {
      throw new Error(
        `Fixture ${fixture.fixtureId}: hex ${hex.id} at ` +
          `(${hex.coordinates.columnIndex},${hex.coordinates.rowIndex}) is outside the ` +
          `${fixture.grid.width}x${fixture.grid.height} technical grid.`,
      );
    }

    tile.tileId = hex.id;
    tile.discovery = hex.initialDiscovery;
  }

  return map;
}

/** Index of authored hexes by coordinate — the fixture's own `getTileAt`. */
export function indexFixtureHexes(fixture: WorldFixture): Map<string, FixtureHex> {
  const byKey = new Map<string, FixtureHex>();
  for (const hex of fixture.hexes) byKey.set(coordinateKey(hex.coordinates), hex);
  return byKey;
}

/**
 * The authored hex at `coordinates`, or null where the fixture authored
 * nothing — which is the same thing as "technical grid, permanently unknown".
 */
export function getFixtureHexAt(
  fixture: WorldFixture,
  coordinates: IHexCoordinates,
): FixtureHex | null {
  return indexFixtureHexes(fixture).get(coordinateKey(coordinates)) ?? null;
}
