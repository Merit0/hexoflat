import {
  StaticBoardDrawingSchema,
  BoardChunkSchema,
  BoardLayoutSchema,
  GeneratedBoardPresetSchema,
} from './schemas';
import { STATIC_DRAWINGS, BOARD_CHUNKS, BOARD_LAYOUTS, BOARD_PRESETS } from './index';

function assertAll<T>(
  items: T[],
  parse: (item: T) => { success: boolean; error?: { message: string } },
  idOf: (item: T) => string,
  kind: string,
): void {
  for (const item of items) {
    const result = parse(item);
    if (!result.success) {
      throw new Error(
        `${kind} "${idOf(item)}" failed content schema validation:\n${result.error?.message}`,
      );
    }
  }
}

/** Runtime Zod validation for the board content catalog, parallel to content/validate-content.ts's hexobject catalog check. Not wired into app bootstrap yet — a later phase decides where this runs. */
export function validateBoardContent(): void {
  assertAll(
    STATIC_DRAWINGS,
    (d) => StaticBoardDrawingSchema.safeParse(d),
    (d) => d.id,
    'static drawing',
  );
  assertAll(
    BOARD_CHUNKS,
    (c) => BoardChunkSchema.safeParse(c),
    (c) => c.id,
    'chunk',
  );
  assertAll(
    BOARD_LAYOUTS,
    (l) => BoardLayoutSchema.safeParse(l),
    (l) => l.id,
    'layout',
  );
  assertAll(
    BOARD_PRESETS,
    (p) => GeneratedBoardPresetSchema.safeParse(p),
    (p) => p.id,
    'preset',
  );
}
