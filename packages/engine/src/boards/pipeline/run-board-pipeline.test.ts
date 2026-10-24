import { describe, expect, it } from 'vitest';
import { buildStaticBoard } from '../build-static-board';
import { SILESIA_BOARD } from '../../content/boards/static/silesia';
import { CAMPING_BOARD } from '../../content/boards/static/camping';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import type { BoardRecipeInput } from '../../content/boards/recipe-schema';
import type { StaticBoardDrawing } from '../../content/boards/schemas';
import { staticRecipe } from '../../content/boards/recipes/static-recipe';
import { BOARD_COLUMNS, BOARD_ROWS } from '../board-size';
import { hashStaticDrawing } from '../drawing-hash';
import { pieceStreamLabel, runBoardPipeline } from './run-board-pipeline';

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

describe('piece RNG streams', () => {
  it('keeps the first occurrence on the historic label and gives repeats their own stream', () => {
    expect(pieceStreamLabel('relief', 'lake', 1)).toBe('relief:lake');
    expect(pieceStreamLabel('relief', 'lake', 2)).toBe('relief:lake#2');
  });

  it('two lake pieces in one recipe both place a separate lake', () => {
    const rows = Array.from(
      { length: BOARD_ROWS },
      (_, row) =>
        (row % 2 === 1 ? ' ' : '') + Array.from({ length: BOARD_COLUMNS }, () => '.').join(' '),
    );
    const field: StaticBoardDrawing = { id: 'field', background: '', legend: {}, rows };
    const twoLakes = (seed: string) =>
      runBoardPipeline(
        {
          ...recipeFor(field, { entryObject: undefined }),
          stages: {
            form: [{ kind: 'drawing', drawing: field }],
            relief: [
              { kind: 'lake', radius: 1, margin: 1 },
              { kind: 'lake', radius: 1, margin: 1 },
            ],
          },
        },
        { seed },
      ).map.tiles.filter((tile) => tile.terrain === 'water').length;

    for (let i = 0; i < 20; i += 1) expect(twoLakes(`lakes-${i}`)).toBe(14);
  });

  it('rejects duplicate rule ids inside one rules piece', () => {
    expect(() =>
      runBoardPipeline(
        {
          ...recipeFor(SILESIA_BOARD),
          stages: {
            form: [{ kind: 'drawing', drawing: SILESIA_BOARD }],
            objects: [
              {
                kind: 'rules',
                rules: [
                  { id: 'twin', pick: 'rock', count: 1 },
                  { id: 'twin', pick: 'tree', count: 1 },
                ],
              },
            ],
          },
        },
        { seed: '' },
      ),
    ).toThrow(/unique/);
  });
});
