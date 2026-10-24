import { describe, expect, it } from 'vitest';
import { CAVE_MODEL } from '@hexoflat/engine/content/boards/models/cave';
import { serializeBoardModel } from '@hexoflat/engine/boards/board-model-serializer';
import { handleBoardModelSaveRequest } from './board-model-save-handler';

describe('handleBoardModelSaveRequest', () => {
  it('accepts a valid model and returns the canonical file to write', () => {
    const result = handleBoardModelSaveRequest(JSON.stringify(CAVE_MODEL));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.fileName).toBe('cave.ts');
    expect(result.fileContent).toBe(serializeBoardModel(CAVE_MODEL));
  });

  it('rejects a body that is not JSON', () => {
    const result = handleBoardModelSaveRequest('nope');

    expect(result.status).toBe(400);
    expect(result.fileName).toBeUndefined();
  });

  it('rejects a model that fails the recipe schema', () => {
    const broken = { ...CAVE_MODEL, frame: { columns: 40, rows: 17 } };
    const result = handleBoardModelSaveRequest(JSON.stringify(broken));

    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.fileName).toBeUndefined();
  });

  it('rejects an id that is not an existing model, including path traversal', () => {
    for (const id of ['../../etc/passwd', 'brand-new', '__proto__']) {
      const result = handleBoardModelSaveRequest(JSON.stringify({ ...CAVE_MODEL, id }));

      expect(result.status).toBe(400);
      expect(result.fileName).toBeUndefined();
    }
  });

  it('rejects a static recipe', () => {
    const result = handleBoardModelSaveRequest(JSON.stringify({ ...CAVE_MODEL, kind: 'static' }));

    expect(result.status).toBe(400);
    expect(result.body.reason).toContain('generated');
  });
});
