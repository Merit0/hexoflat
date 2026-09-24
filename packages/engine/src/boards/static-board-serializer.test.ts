import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StaticBoardDrawingSchema } from '../content/boards/schemas';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { serializeStaticBoardDrawing } from './static-board-serializer';
import { deserializeStaticBoardDrawing } from './static-board-deserializer';

const SILESIA_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../content/boards/static/silesia.ts',
);

describe('static board serializer/deserializer', () => {
  it('parse -> serialize -> parse gives the same board', () => {
    const parsed = StaticBoardDrawingSchema.parse(SILESIA_BOARD);
    const text = serializeStaticBoardDrawing(parsed);
    const roundTripped = StaticBoardDrawingSchema.parse(deserializeStaticBoardDrawing(text));

    expect(roundTripped).toEqual(parsed);
  });

  it('is idempotent: serializing twice through a round trip gives the same text', () => {
    const text = serializeStaticBoardDrawing(SILESIA_BOARD);
    const textAgain = serializeStaticBoardDrawing(deserializeStaticBoardDrawing(text));

    expect(textAgain).toBe(text);
  });

  it('sorts the legend and drops letters no longer used by any cell', () => {
    const drawing = {
      id: 'test',
      background: '',
      legend: {
        Z: { hexobjectKey: 'rock' as const },
        A: { hexobjectKey: 'tree' as const },
        Q: { hexobjectKey: 'chest' as const },
      },
      rows: ['. A', ' Z .'],
    };

    const text = serializeStaticBoardDrawing(drawing);

    expect(text.indexOf('A:')).toBeLessThan(text.indexOf('Z:'));
    expect(text).not.toContain('Q:');
  });

  it('serializes overrides on one line, matching the plan doc example', () => {
    const text = serializeStaticBoardDrawing(SILESIA_BOARD);
    expect(text).toContain('overrides: { regrowMs: 25000 }');
  });

  it('is byte-identical to the committed silesia.ts — an editor Save with no real change must produce no git diff', () => {
    const onDisk = readFileSync(SILESIA_FILE, 'utf8');
    expect(serializeStaticBoardDrawing(SILESIA_BOARD)).toBe(onDisk);
  });
});
