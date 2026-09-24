import { describe, expect, it } from 'vitest';
import { SILESIA_BOARD } from '@hexoflat/engine/content/boards/static/silesia';
import { handleStaticBoardSaveRequest } from './static-board-save-handler';

describe('handleStaticBoardSaveRequest', () => {
  it('accepts a valid drawing and returns the canonical file to write', () => {
    const result = handleStaticBoardSaveRequest(JSON.stringify(SILESIA_BOARD));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.fileName).toBe('silesia.ts');
    expect(result.fileContent).toContain('export const SILESIA_BOARD');
  });

  it('rejects a request body that is not JSON', () => {
    const result = handleStaticBoardSaveRequest('not json');

    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.fileName).toBeUndefined();
  });

  it('rejects a drawing that fails the schema/linter', () => {
    const invalid = { ...SILESIA_BOARD, rows: ['. .'] };
    const result = handleStaticBoardSaveRequest(JSON.stringify(invalid));

    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.body.reason).toContain('must be exactly');
  });

  it('rejects a drawing id that would escape the static boards directory', () => {
    const traversal = { ...SILESIA_BOARD, id: '../../etc/passwd' };
    const result = handleStaticBoardSaveRequest(JSON.stringify(traversal));

    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.body.reason).toContain('lowercase letters');
    expect(result.fileName).toBeUndefined();
  });
});
