import { describe, expect, it } from 'vitest';
import { STATIC_DRAWINGS } from './index';
import { validateBoardContent } from './validate-board-content';
import { lintExits, lintStaticDrawing } from '../../boards/board-linter';
import { BOARD_ATLAS, BoardAtlasSchema, expectedExitSides } from './atlas';
import { BOARD_COLUMNS, BOARD_ROWS } from '../../boards/board-size';
import { StaticBoardDrawingSchema } from './schemas';
import { RecipeSchema } from './recipe-schema';
import { CAVE_MODEL } from './models/cave';
import { CONTENT_VERSION } from '../content-version';

describe('board content library', () => {
  it('does not need to bump CONTENT_VERSION', () => {
    expect(CONTENT_VERSION).toBe(1);
  });

  it('passes Zod schema validation', () => {
    expect(() => validateBoardContent()).not.toThrow();
  });

  it.each(STATIC_DRAWINGS)('static drawing "$id" passes the library linter', (drawing) => {
    expect(lintStaticDrawing(drawing, BOARD_COLUMNS, BOARD_ROWS)).toEqual([]);
  });

  it.each(STATIC_DRAWINGS)(
    'static drawing "$id" has an exit exactly on the sides where the atlas has a neighbour (REQ-BOARD-009)',
    (drawing) => {
      expect(lintExits(drawing, expectedExitSides(drawing.id))).toEqual([]);
    },
  );

  it('REQ-BOARD-009 flags a missing and a surplus exit', () => {
    const silesia = STATIC_DRAWINGS.find((drawing) => drawing.id === 'silesia')!;
    expect(lintExits(silesia, ['N', 'E']).join('\n')).toMatch(/neighbour on E/);
    expect(lintExits(silesia, []).join('\n')).toMatch(/exit on N has no atlas neighbour/);
  });

  it('the atlas schema rejects unknown board ids and two boards on one position', () => {
    expect(BoardAtlasSchema.safeParse(BOARD_ATLAS).success).toBe(true);
    expect(BoardAtlasSchema.safeParse({ atlantis: { x: 5, y: 5 } }).success).toBe(false);
    const clash = BoardAtlasSchema.safeParse({ silesia: { x: 0, y: 0 }, cave: { x: 0, y: 0 } });
    expect(clash.success).toBe(false);
    expect(clash.error?.message).toMatch(/share position 0:0/);
    expect(BoardAtlasSchema.safeParse({ silesia: { x: 0.5, y: 0 } }).success).toBe(false);
  });

  it('every atlas board is a known static drawing', () => {
    const ids = new Set(STATIC_DRAWINGS.map((drawing) => drawing.id));
    for (const id of Object.keys(BOARD_ATLAS)) expect(ids.has(id), id).toBe(true);
  });

  describe('REQ-BOARD-001: frame is at most BOARD_COLUMNS x BOARD_ROWS', () => {
    const cells = (count: number) => Array.from({ length: count }, () => '.').join(' ');
    const drawing = (rows: string[]) => ({ id: 'x', background: '', legend: {}, rows });

    it('accepts a full-frame drawing', () => {
      const rows = Array.from({ length: BOARD_ROWS }, () => cells(BOARD_COLUMNS));
      expect(StaticBoardDrawingSchema.safeParse(drawing(rows)).success).toBe(true);
    });

    it('rejects too many rows', () => {
      const rows = Array.from({ length: BOARD_ROWS + 1 }, () => cells(3));
      expect(StaticBoardDrawingSchema.safeParse(drawing(rows)).success).toBe(false);
    });

    it('rejects too many cells in a row', () => {
      const rows = [cells(BOARD_COLUMNS + 1)];
      expect(StaticBoardDrawingSchema.safeParse(drawing(rows)).success).toBe(false);
    });

    it('rejects a recipe frame larger than the board', () => {
      expect(
        RecipeSchema.safeParse({ ...CAVE_MODEL, frame: { columns: BOARD_COLUMNS + 1, rows: 3 } })
          .success,
      ).toBe(false);
      expect(
        RecipeSchema.safeParse({ ...CAVE_MODEL, frame: { columns: 3, rows: BOARD_ROWS + 1 } })
          .success,
      ).toBe(false);
    });
  });
});
