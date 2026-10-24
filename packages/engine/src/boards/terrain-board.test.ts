import { describe, expect, it } from 'vitest';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import { findShortestPath } from '../hero-movement/pathfinding-service';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import { staticRecipe } from '../content/boards/recipes/static-recipe';
import { buildStaticBoard } from './build-static-board';
import { lintStaticDrawing } from './board-linter';
import { measureBoard } from './measure-board';
import { runBoardPipeline } from './pipeline/run-board-pipeline';
import { serializeStaticBoardDrawing } from './static-board-serializer';
import { deserializeStaticBoardDrawing } from './static-board-deserializer';

function drawing(rows: string[], legend: StaticBoardDrawing['legend'] = {}): StaticBoardDrawing {
  return { id: 'terrain-probe', background: '', legend, rows };
}

const RIVER = drawing([
  '. . . = . . .',
  ' . . . = . . .',
  '. . . = . . .',
  ' . . . . . . .',
  '. . . = . . .',
]);

function revealAll(map: HexMapModel): void {
  for (const tile of map.tiles) tile.isRevealed = true;
}

describe('terrain on boards', () => {
  it('buildStaticBoard reads ^ and = into tile terrain and leaves other tiles ground', () => {
    const { map } = buildStaticBoard(drawing(['. ^ =']));
    expect(map.tiles.map((tile) => tile.terrain)).toEqual(['ground', 'mountain', 'water']);
  });

  it('RELIEF:drawing gives the pipeline the same terrain as buildStaticBoard', () => {
    const built = runBoardPipeline(
      staticRecipe(RIVER, { fog: 'FOG', entryObject: HEXOBJECT_KEYS.CAMPING_ENTRANCE }),
      { seed: '' },
    );
    expect(built.map.toJSON()).toEqual(buildStaticBoard(RIVER).map.toJSON());
    expect(built.map.tiles.filter((tile) => tile.terrain === 'water')).toHaveLength(4);
  });

  it('pathfinding goes around water through the only gap', () => {
    const { map } = buildStaticBoard(RIVER);
    revealAll(map);

    const path = findShortestPath(
      map,
      { columnIndex: 0, rowIndex: 0 },
      { columnIndex: 6, rowIndex: 0 },
    );

    expect(path).not.toBeNull();
    expect(path?.some((step) => step.rowIndex === 3)).toBe(true);
    for (const step of path ?? []) {
      const tile = map.tiles.find(
        (candidate) =>
          candidate.coordinates.columnIndex === step.columnIndex &&
          candidate.coordinates.rowIndex === step.rowIndex,
      );
      expect(tile?.terrain).toBe('ground');
    }
  });

  it('pathfinding refuses to end on a mountain or water tile', () => {
    const { map } = buildStaticBoard(drawing(['. ^ =']));
    revealAll(map);
    const start = { columnIndex: 0, rowIndex: 0 };

    expect(findShortestPath(map, start, { columnIndex: 1, rowIndex: 0 })).toBeNull();
    expect(findShortestPath(map, start, { columnIndex: 2, rowIndex: 0 })).toBeNull();
  });

  it('terrain survives toJSON/fromJSON and old saves without terrain load as ground', () => {
    const { map } = buildStaticBoard(drawing(['. ^ =']));
    const json = map.toJSON();

    expect(json.tiles.map((tile) => 'terrain' in tile)).toEqual([false, true, true]);
    const restored = HexMapModel.fromJSON(JSON.parse(JSON.stringify(json)) as ISerializedHexMap, 0);
    expect(restored.tiles.map((tile) => tile.terrain)).toEqual(['ground', 'mountain', 'water']);

    const legacy = JSON.parse(JSON.stringify(json)) as ISerializedHexMap;
    for (const tile of legacy.tiles) delete tile.terrain;
    expect(HexMapModel.fromJSON(legacy, 0).tiles.every((tile) => tile.terrain === 'ground')).toBe(
      true,
    );
  });

  it('CHECKS:reachable fails when water cuts an object off from the entrance', () => {
    const legend = {
      G: { hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
      R: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
    };
    const build = (rows: string[]) => {
      const recipe = staticRecipe(drawing(rows, legend), {
        fog: 'FOG',
        entryObject: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      });
      const withCheck = {
        ...recipe,
        stages: { ...recipe.stages, checks: [{ kind: 'reachable' }] },
      };
      return () => runBoardPipeline(withCheck, { seed: '' });
    };

    expect(build(['R = G .', ' . = . .', '. = . .'])).toThrow(/every attempt failed/);
    expect(build(['R . G .', ' . . . .', '. . . .'])).not.toThrow();
  });

  it('measureBoard treats water as impassable', () => {
    const rows = ['G . = . .', ' . . = . .', '. . = . R'];
    const legend = {
      G: { hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
      R: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
    };
    const measured = measureBoard(
      buildStaticBoard(drawing(rows, legend)).map,
      HEXOBJECT_KEYS.CAMPING_ENTRANCE,
    );

    expect(measured.stepsToObject[HEXOBJECT_KEYS.ROCK]).toBeNull();
    expect(measured.passableTiles).toBe(10);
  });

  it('the static drawing linter and serializer keep ^ and = without legend entries', () => {
    expect(lintStaticDrawing(RIVER, 7, 5)).toEqual([]);
    const restored = deserializeStaticBoardDrawing(serializeStaticBoardDrawing(RIVER));
    expect(restored.rows).toEqual(RIVER.rows);
  });
});
