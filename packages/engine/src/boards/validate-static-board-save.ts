import { StaticBoardDrawingSchema, type StaticBoardDrawing } from '../content/boards/schemas';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';
import { lintStaticDrawing } from './board-linter';

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

  return { ok: true, drawing: parsed.data };
}
