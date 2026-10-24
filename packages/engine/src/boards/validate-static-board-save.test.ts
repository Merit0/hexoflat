import { describe, expect, it } from 'vitest';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { validateStaticBoardForSave } from './validate-static-board-save';

describe('validateStaticBoardForSave', () => {
  it('accepts a drawing that matches the schema and passes the linter', () => {
    const result = validateStaticBoardForSave(SILESIA_BOARD);
    expect(result.ok).toBe(true);
  });

  it('rejects a candidate that fails the Zod schema', () => {
    const result = validateStaticBoardForSave({ id: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });

  it('rejects a schema-valid drawing that the linter flags, e.g. wrong dimensions', () => {
    const tooSmall = {
      id: 'test',
      background: '',
      legend: {},
      rows: ['. .', ' . .'],
    };
    const result = validateStaticBoardForSave(tooSmall);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('must be exactly');
  });

  it('rejects a drawing using a symbol with no legend entry', () => {
    const withStrayLetter = {
      ...SILESIA_BOARD,
      rows: SILESIA_BOARD.rows.map((row, index) => (index === 4 ? row.replace('.', 'Z') : row)),
    };
    const result = validateStaticBoardForSave(withStrayLetter);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('no legend entry');
  });
});
