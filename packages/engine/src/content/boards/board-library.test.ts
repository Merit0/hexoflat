import { describe, expect, it } from 'vitest';
import { STATIC_DRAWINGS, BOARD_CHUNKS, BOARD_LAYOUTS, BOARD_PRESETS } from './index';
import { validateBoardContent } from './validate-board-content';
import {
  lintStaticDrawing,
  lintChunk,
  lintLayout,
  lintPresetChunkAvailability,
} from '../../boards/board-linter';
import { BOARD_COLUMNS, BOARD_ROWS } from '../../boards/board-size';
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

  it.each(BOARD_CHUNKS)('chunk "$id" passes the library linter', (chunk) => {
    expect(lintChunk(chunk)).toEqual([]);
  });

  it.each(BOARD_LAYOUTS)('layout "$id" passes the library linter', (layout) => {
    expect(lintLayout(layout, BOARD_COLUMNS, BOARD_ROWS)).toEqual([]);
  });

  it.each(BOARD_PRESETS)(
    'preset "$id" has a chunk pool for every zone of every layout it uses',
    (preset) => {
      expect(lintPresetChunkAvailability(preset, BOARD_LAYOUTS, BOARD_CHUNKS)).toEqual([]);
    },
  );
});
