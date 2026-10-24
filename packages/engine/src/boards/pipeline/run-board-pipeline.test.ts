import { describe, expect, it } from 'vitest';
import { buildStaticBoard } from '../build-static-board';
import { SILESIA_BOARD } from '../../content/boards/static/silesia';
import { CAMPING_BOARD } from '../../content/boards/static/camping';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import type { BoardRecipeInput } from '../../content/boards/recipe-schema';
import type { StaticBoardDrawing } from '../../content/boards/schemas';
import { staticRecipe } from '../../content/boards/recipes/static-recipe';
import { hashStaticDrawing } from '../drawing-hash';
import { runBoardPipeline } from './run-board-pipeline';

function recipeFor(
  drawing: StaticBoardDrawing,
  extra: Partial<BoardRecipeInput> = {},
): BoardRecipeInput {
  return {
    ...staticRecipe(drawing, { fog: 'FOG', entryObject: HEXOBJECT_KEYS.CAMPING_ENTRANCE }),
    ...extra,
  };
}

describe('runBoardPipeline', () => {
  it.each([
    ['silesia', SILESIA_BOARD, 'FOG' as const],
    ['camping', CAMPING_BOARD, 'ALL_REVEALED' as const],
  ])(
    'FORM:drawing + GATES:drawing + OBJECTS:drawing rebuild %s exactly like buildStaticBoard',
    (_name, drawing, fog) => {
      const legacy = buildStaticBoard(drawing, fog);
      const built = runBoardPipeline(recipeFor(drawing, { fog }), { seed: '' });

      expect(built.map.toJSON()).toEqual(legacy.map.toJSON());
      expect(built.map.fogPolicy).toBe(legacy.map.fogPolicy);
      expect(built.descriptor).toEqual({
        kind: 'STATIC',
        id: drawing.id,
        drawingHash: hashStaticDrawing(drawing),
      });
    },
  );

  it('records a trace entry for every placed cell', () => {
    const built = runBoardPipeline(recipeFor(SILESIA_BOARD), { seed: '' });

    expect(built.trace.cellCount).toBe(built.map.tiles.length);
    const gate = built.map.tiles.find(
      (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAVE_ENTRANCE,
    );
    const stages = built.trace.entriesAt(gate!.coordinates).map((entry) => entry.stage);
    expect(stages).toEqual(['form', 'gates']);
  });

  it('CHECKS:reachable passes for silesia from its entrance and reports measures', () => {
    const built = runBoardPipeline(
      recipeFor(SILESIA_BOARD, {
        entryObject: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
        stages: {
          form: [{ kind: 'drawing', drawing: SILESIA_BOARD }],
          gates: [{ kind: 'drawing' }],
          objects: [{ kind: 'drawing' }],
          checks: [{ kind: 'reachable' }],
        },
      }),
      { seed: '' },
    );

    expect(built.measures?.stepsToObject[HEXOBJECT_KEYS.CAVE_ENTRANCE]).toBeGreaterThan(0);
  });

  it('CHECKS:reachable fails the build when the recipe has no entry object', () => {
    expect(() =>
      runBoardPipeline(
        recipeFor(SILESIA_BOARD, {
          entryObject: undefined,
          stages: {
            form: [{ kind: 'drawing', drawing: SILESIA_BOARD }],
            checks: [{ kind: 'reachable' }],
          },
        }),
        { seed: '' },
      ),
    ).toThrow(/every attempt failed/);
  });

  it('BOUNDS:wall turns wall cells with no floor beside them into void', () => {
    const drawing: StaticBoardDrawing = {
      id: 'wall-probe',
      background: '',
      legend: {},
      rows: ['. # ~ # #', ' ~ ~ ~ # #'],
    };
    const wallKey = HEXOBJECT_KEYS.STONE_WALL;
    const built = runBoardPipeline(
      recipeFor(drawing, {
        stages: { form: [{ kind: 'drawing', drawing }], bounds: [{ kind: 'wall' }] },
      }),
      { seed: '' },
    );

    const walls = built.map.tiles.filter((tile) => tile.hexobject?.hexobjectKey === wallKey);
    expect(walls.map((tile) => tile.coordinates)).toEqual([{ columnIndex: 1, rowIndex: 0 }]);
  });

  it('rejects an unknown piece kind', () => {
    expect(() =>
      runBoardPipeline(
        recipeFor(SILESIA_BOARD, {
          stages: { form: [{ kind: 'nope' }] },
        }),
        { seed: '' },
      ),
    ).toThrow(/no form piece "nope"/);
  });

  it('keeps a frame inside the 18x17 limit', () => {
    expect(() =>
      runBoardPipeline(recipeFor(SILESIA_BOARD, { frame: { columns: 19, rows: 17 } }), {
        seed: '',
      }),
    ).toThrow();
  });
});
