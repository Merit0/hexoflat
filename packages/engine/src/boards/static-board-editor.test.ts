import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import {
  findOrAllocateLegendLetter,
  listBoardObjects,
  placeGroundAt,
  placeHexobjectAt,
  placeMountainAt,
  placeWaterAt,
  removeAllOfKind,
  placeVoidAt,
  placeWallAt,
} from './static-board-editor';

function tinyDrawing(): StaticBoardDrawing {
  return {
    id: 'test',
    background: '',
    legend: { A: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 25000 } } },
    rows: ['. . .', ' . A .', '. . .'],
  };
}

describe('findOrAllocateLegendLetter', () => {
  it('reuses an existing letter for an identical hexobjectKey + overrides', () => {
    const legend = { A: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 25000 } } };
    const letter = findOrAllocateLegendLetter(legend, {
      hexobjectKey: HEXOBJECT_KEYS.TREE,
      overrides: { regrowMs: 25000 },
    });
    expect(letter).toBe('A');
  });

  it('allocates a new letter when the entry differs', () => {
    const legend = { A: { hexobjectKey: HEXOBJECT_KEYS.TREE } };
    const letter = findOrAllocateLegendLetter(legend, { hexobjectKey: HEXOBJECT_KEYS.ROCK });
    expect(letter).toBe('B');
  });

  it('skips letters already taken by unrelated entries', () => {
    const legend = {
      A: { hexobjectKey: HEXOBJECT_KEYS.TREE },
      B: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
    };
    const letter = findOrAllocateLegendLetter(legend, { hexobjectKey: HEXOBJECT_KEYS.CHEST });
    expect(letter).toBe('C');
  });
});

describe('cell placement', () => {
  it('placeGroundAt clears whatever was on that cell', () => {
    const drawing = placeGroundAt(tinyDrawing(), { columnIndex: 1, rowIndex: 1 });
    expect(drawing.rows[1].trim().split(/\s+/)[1]).toBe('.');
  });

  it('placeWallAt / placeVoidAt set the structural symbol', () => {
    const withWall = placeWallAt(tinyDrawing(), { columnIndex: 0, rowIndex: 0 });
    expect(withWall.rows[0].trim().split(/\s+/)[0]).toBe('#');

    const withVoid = placeVoidAt(tinyDrawing(), { columnIndex: 0, rowIndex: 0 });
    expect(withVoid.rows[0].trim().split(/\s+/)[0]).toBe('~');
  });

  it('placeHexobjectAt reuses the matching legend letter instead of growing the legend', () => {
    const drawing = tinyDrawing();
    const updated = placeHexobjectAt(drawing, { columnIndex: 0, rowIndex: 0 }, HEXOBJECT_KEYS.TREE);

    expect(Object.keys(updated.legend)).toHaveLength(2);
    expect(updated.rows[0].trim().split(/\s+/)[0]).toBe('B');
    expect(updated.legend.B).toEqual({ hexobjectKey: HEXOBJECT_KEYS.TREE });
  });

  it('placeHexobjectAt reuses a letter across repeated identical placements', () => {
    let drawing = tinyDrawing();
    drawing = placeHexobjectAt(drawing, { columnIndex: 0, rowIndex: 0 }, HEXOBJECT_KEYS.ROCK);
    drawing = placeHexobjectAt(drawing, { columnIndex: 2, rowIndex: 2 }, HEXOBJECT_KEYS.ROCK);

    expect(Object.keys(drawing.legend)).toHaveLength(2);
    expect(drawing.rows[0].trim().split(/\s+/)[0]).toBe(drawing.rows[2].trim().split(/\s+/)[2]);
  });

  it('does not mutate the input drawing', () => {
    const drawing = tinyDrawing();
    const originalRows = [...drawing.rows];

    placeGroundAt(drawing, { columnIndex: 1, rowIndex: 1 });

    expect(drawing.rows).toEqual(originalRows);
  });
});

describe('terrain brushes', () => {
  it('placeMountainAt and placeWaterAt write ^ and = and keep the board shape', () => {
    const withMountain = placeMountainAt(tinyDrawing(), { columnIndex: 0, rowIndex: 0 });
    const withBoth = placeWaterAt(withMountain, { columnIndex: 2, rowIndex: 2 });

    expect(withBoth.rows).toEqual(['^ . .', ' . A .', '. . =']);
    expect(withBoth.rows.map((row) => row.trim().split(/\s+/).length)).toEqual([3, 3, 3]);
  });
});

describe('listBoardObjects / removeAllOfKind', () => {
  const field: StaticBoardDrawing = {
    id: 'field',
    background: '',
    legend: {
      A: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 25000 } },
      B: { hexobjectKey: HEXOBJECT_KEYS.TREE },
      R: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
    },
    rows: ['A . B', ' . R .', 'R . A'],
  };

  it('listBoardObjects groups cells per kind across legend variants, sorted by key', () => {
    const objects = listBoardObjects(field);

    expect(objects.map((item) => [item.hexobjectKey, item.count])).toEqual([
      [HEXOBJECT_KEYS.ROCK, 2],
      [HEXOBJECT_KEYS.TREE, 3],
    ]);
    expect(objects[1].cellKeys).toEqual(['0:0', '2:0', '2:2']);
  });

  it('removeAllOfKind turns every cell of that kind into ground and drops its legend entries', () => {
    const cleaned = removeAllOfKind(field, HEXOBJECT_KEYS.TREE);

    expect(cleaned.rows).toEqual(['. . .', ' . R .', 'R . .']);
    expect(Object.keys(cleaned.legend)).toEqual(['R']);
    expect(listBoardObjects(cleaned).map((item) => item.hexobjectKey)).toEqual([
      HEXOBJECT_KEYS.ROCK,
    ]);
  });

  it('removeAllOfKind leaves a drawing without that kind untouched', () => {
    expect(removeAllOfKind(field, HEXOBJECT_KEYS.CHEST)).toEqual(field);
  });
});
