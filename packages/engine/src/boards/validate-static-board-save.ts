import { StaticBoardDrawingSchema, type StaticBoardDrawing } from '../content/boards/schemas';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';
import { lintStaticDrawing } from './board-linter';
import { assertDrawingDimension } from './board-dimension';

export type ValidateStaticBoardResult =
  { ok: true; drawing: StaticBoardDrawing } | { ok: false; reason: string };

export function validateStaticBoardForSave(candidate: unknown): ValidateStaticBoardResult {
  const parsed = StaticBoardDrawingSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((issue) => issue.message).join('; ') };
  }

  const issues = lintStaticDrawing(parsed.data, BOARD_COLUMNS, BOARD_ROWS);
  if (issues.length > 0) {
    return { ok: false, reason: issues.join('; ') };
  }

  try {
    assertDrawingDimension(parsed.data, parsed.data);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  return { ok: true, drawing: parsed.data };
}
