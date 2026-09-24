import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import {
  findOrAllocateLegendLetter,
  placeGroundAt,
  placeHexobjectAt,
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
