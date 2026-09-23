import { describe, expect, it } from 'vitest';
import { HexMapProvider } from '../map/providers/hex-map-provider';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { buildStaticBoard } from './build-static-board';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';
import { coordinateKey } from '../utils/hex-utils';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';

describe('buildStaticBoard', () => {
  it('reproduces HexMapProvider.getHomeLand() 1:1 inside the 18x17 frame', () => {
    const legacy = HexMapProvider.getHomeLand();
    const { map } = buildStaticBoard(SILESIA_BOARD);

    expect(map.width).toBe(BOARD_COLUMNS);
    expect(map.height).toBe(BOARD_ROWS);

    const legacyByKey = new Map(
      legacy.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]),
    );
    const builtByKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));

    for (const [key, legacyTile] of legacyByKey) {
      const builtTile = builtByKey.get(key);
      expect(builtTile, `missing tile at ${key}`).toBeDefined();
      expect(builtTile?.hexobject?.hexobjectKey).toBe(legacyTile.hexobject?.hexobjectKey);
      if (legacyTile.hexobject?.groupType === EHexobjectGroup.RESOURCE) {
        expect((builtTile?.hexobject as typeof legacyTile.hexobject)?.resource?.regrowMs).toBe(
          legacyTile.hexobject.resource.regrowMs,
        );
      }
    }

    for (let col = 0; col < 17; col += 1) {
      for (let row = 0; row < 15; row += 1) {
        expect(
          builtByKey.has(coordinateKey({ columnIndex: col, rowIndex: row })),
          `${col},${row} should exist`,
        ).toBe(true);
      }
    }

    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      for (let row = 0; row < BOARD_ROWS; row += 1) {
        if (col < 17 && row < 15) continue;
        expect(
          builtByKey.has(coordinateKey({ columnIndex: col, rowIndex: row })),
          `${col},${row} should be void`,
        ).toBe(false);
      }
    }

    expect(map.tiles.length).toBe(legacy.tiles.length);

    const placedObjectCount = map.tiles.filter((tile) => tile.hexobject).length;
    const configObjectCount = map.config.reduce(
      (sum, placement) => sum + placement.coordinates.length,
      0,
    );
    expect(configObjectCount).toBe(placedObjectCount);
  });

  it('is identical on every call and its drawingHash is stable', () => {
    const first = buildStaticBoard(SILESIA_BOARD);
    const second = buildStaticBoard(SILESIA_BOARD);

    expect(first.descriptor.drawingHash).toBe(second.descriptor.drawingHash);
    expect(first.map.tiles.length).toBe(second.map.tiles.length);
  });
});
