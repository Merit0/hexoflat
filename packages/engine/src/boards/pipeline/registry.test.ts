import { describe, expect, it } from 'vitest';
import { listRegisteredPieces } from './registry';

describe('pipeline registries (REQ-BOARD-011)', () => {
  const pieces = listRegisteredPieces();

  it('registers at least one piece', () => {
    expect(pieces.length).toBeGreaterThan(0);
  });

  it.each(pieces)('$stage:$id has a Zod schema and a non-empty tableRule', (piece) => {
    expect(typeof piece.schema.safeParse).toBe('function');
    expect(piece.tableRule.trim().length).toBeGreaterThan(10);
  });
});
