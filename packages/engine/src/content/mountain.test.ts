import { describe, expect, it } from 'vitest';
import { CONTENT } from './content-map';
import { getPrototype } from './content-accessors';
import { EHexActionType } from '../enums/hex-action-type';
import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { buildStaticBoard } from '../boards/build-static-board';
import { SILESIA_BOARD } from './boards/static/silesia';
import { SILESIA_NORTH_BOARD } from './boards/static/silesia-north';
import { initFog } from '../map/fog-service';
import { HexObjectFactory } from '../factory/hex-object-factory';

describe('mountain (a rock wall you can mine through)', () => {
  const mountain = CONTENT[HEXOBJECT_KEYS.MOUNTAIN];
  const rock = CONTENT[HEXOBJECT_KEYS.ROCK];

  it('blocks like a wall but is mined with the same tool, cost and yield as a rock', () => {
    expect(mountain.collision).toBe(EHexCollision.SOLID);
    expect(mountain.actions?.[EHexActionType.MINE]).toEqual(rock.actions?.[EHexActionType.MINE]);
    expect(mountain.yields).toEqual(rock.yields);
    expect(mountain.spritePath).toBe(rock.spritePath);
  });

  it('never regrows, so a mined mountain stays open ground', () => {
    const instance = HexObjectFactory.create(HEXOBJECT_KEYS.MOUNTAIN, {
      columnIndex: 0,
      rowIndex: 0,
    });
    expect(instance.groupType).toBe(EHexobjectGroup.RESOURCE);
    expect('resource' in instance && instance.resource.regrowMs).toBeFalsy();
  });

  it('carries its visibility and stone background to the placed object', () => {
    const proto = getPrototype(HEXOBJECT_KEYS.MOUNTAIN);
    expect(proto.alwaysVisible).toBe(true);
    expect(proto.tileBackground).toBe('/hex-assets/board-hexes/stone-hex.png');
    expect(getPrototype(HEXOBJECT_KEYS.ROCK).alwaysVisible).toBeUndefined();
  });

  it.each([SILESIA_BOARD, SILESIA_NORTH_BOARD])(
    '$id: interior mountains are mineable objects, border mountains stay terrain, and all are in view from the start',
    (drawing) => {
      const { map } = buildStaticBoard(drawing);
      initFog(map);
      const mineable = map.tiles.filter(
        (t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.MOUNTAIN,
      );
      const border = map.tiles.filter((t) => t.terrain === 'mountain');

      expect(mineable.length).toBeGreaterThan(20);
      expect(border.length).toBeGreaterThan(20);
      expect(mineable.every((t) => t.isRevealed && t.terrain === 'ground')).toBe(true);
      expect(border.every((t) => t.isRevealed && !t.hexobject)).toBe(true);
    },
  );

  it('a border mountain has no neighbour outside the shape that could be mined from beyond it', () => {
    const { map } = buildStaticBoard(SILESIA_BOARD);
    const mineableKeys = new Set(
      map.tiles
        .filter((t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.MOUNTAIN)
        .map((t) => `${t.coordinates.columnIndex}:${t.coordinates.rowIndex}`),
    );
    for (const tile of map.tiles) {
      const { columnIndex, rowIndex } = tile.coordinates;
      const onFrameEdge =
        columnIndex === 0 || rowIndex === 0 || columnIndex === 17 || rowIndex === 16;
      if (onFrameEdge) expect(mineableKeys.has(`${columnIndex}:${rowIndex}`)).toBe(false);
    }
  });
});
