import type { StaticBoardDrawing } from '../content/boards/schemas';
import { classifyExits, type ExitSide } from './exits';
import { parseBoardRows, boardRowsAreRectangular } from './board-rows';
import {
  GROUND_SYMBOL,
  MOUNTAIN_SYMBOL,
  VOID_SYMBOL,
  WALL_SYMBOL,
  WATER_SYMBOL,
  EXIT_SYMBOL,
} from './board-symbols';

const STATIC_SYMBOLS = new Set([
  GROUND_SYMBOL,
  WALL_SYMBOL,
  VOID_SYMBOL,
  MOUNTAIN_SYMBOL,
  WATER_SYMBOL,
  EXIT_SYMBOL,
]);

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

export function lintExits(drawing: StaticBoardDrawing, expectedSides: ExitSide[]): string[] {
  const found = new Set(classifyExits(parseBoardRows(drawing.rows)).values());
  const expected = new Set(expectedSides);
  const issues: string[] = [];

  for (const side of expected) {
    if (!found.has(side)) {
      issues.push(
        `drawing "${drawing.id}": atlas has a neighbour on ${side} but no '>' exit there`,
      );
    }
  }
  for (const side of found) {
    if (!expected.has(side)) {
      issues.push(`drawing "${drawing.id}": '>' exit on ${side} has no atlas neighbour`);
    }
  }
  return issues;
}
