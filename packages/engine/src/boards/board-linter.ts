import type { StaticBoardDrawing } from '../content/boards/schemas';
import { parseBoardRows, boardRowsAreRectangular } from './board-rows';
import { GROUND_SYMBOL, VOID_SYMBOL, WALL_SYMBOL } from './board-symbols';

const STATIC_SYMBOLS = new Set([GROUND_SYMBOL, WALL_SYMBOL, VOID_SYMBOL]);

export function lintStaticDrawing(
  drawing: StaticBoardDrawing,
  boardColumns: number,
  boardRows: number,
): string[] {
  const issues: string[] = [];
  const grid = parseBoardRows(drawing.rows);

  if (!boardRowsAreRectangular(grid)) {
    issues.push(`drawing "${drawing.id}": rows are not rectangular`);
  }
  if (grid.length !== boardRows || grid.some((row) => row.length !== boardColumns)) {
    issues.push(`drawing "${drawing.id}": must be exactly ${boardColumns}x${boardRows}`);
  }

  for (const row of grid) {
    for (const symbol of row) {
      if (STATIC_SYMBOLS.has(symbol)) continue;
      if (!drawing.legend[symbol]) {
        issues.push(`drawing "${drawing.id}": symbol "${symbol}" has no legend entry`);
      }
    }
  }

  return issues;
}
