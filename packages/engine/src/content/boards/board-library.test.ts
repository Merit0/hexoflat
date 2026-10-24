import { describe, expect, it } from 'vitest';
import { STATIC_DRAWINGS } from './index';
import { validateBoardContent } from './validate-board-content';
import { lintStaticDrawing } from '../../boards/board-linter';
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
