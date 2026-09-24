import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { LegendEntry, StaticBoardDrawing } from '../content/boards/schemas';
import { parseBoardRows, formatBoardRow } from './board-rows';
import { GROUND_SYMBOL, WALL_SYMBOL, VOID_SYMBOL } from './board-symbols';

const LETTER_ALPHABET = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  ...Array.from({ length: 10 }, (_, i) => String(i)),
];

function legendEntriesEqual(a: LegendEntry, b: LegendEntry): boolean {
  if (a.hexobjectKey !== b.hexobjectKey) return false;
  return JSON.stringify(a.overrides ?? {}) === JSON.stringify(b.overrides ?? {});
}

export function findOrAllocateLegendLetter(
  legend: StaticBoardDrawing['legend'],
  entry: LegendEntry,
): string {
  for (const [letter, existing] of Object.entries(legend)) {
    if (legendEntriesEqual(existing, entry)) return letter;
  }

  const used = new Set(Object.keys(legend));
  const free = LETTER_ALPHABET.find((letter) => !used.has(letter));
  if (!free) throw new Error('static board editor: no free legend letter or digit left');
  return free;
}

function withCell(
  drawing: StaticBoardDrawing,
  coord: IHexCoordinates,
  symbol: string,
): StaticBoardDrawing {
  const grid = parseBoardRows(drawing.rows);
  const row = grid[coord.rowIndex];
  if (!row || coord.columnIndex < 0 || coord.columnIndex >= row.length) {
    throw new Error(
      `static board editor: (${coord.columnIndex},${coord.rowIndex}) is outside the drawing`,
    );
  }

  const nextRow = [...row];
  nextRow[coord.columnIndex] = symbol;
  const rows = grid.map((cells, rowIndex) =>
    rowIndex === coord.rowIndex
      ? formatBoardRow(nextRow, rowIndex)
      : formatBoardRow(cells, rowIndex),
  );

  return { ...drawing, rows };
}

export function placeGroundAt(
  drawing: StaticBoardDrawing,
  coord: IHexCoordinates,
): StaticBoardDrawing {
  return withCell(drawing, coord, GROUND_SYMBOL);
}

export function placeWallAt(
  drawing: StaticBoardDrawing,
  coord: IHexCoordinates,
): StaticBoardDrawing {
  return withCell(drawing, coord, WALL_SYMBOL);
}

export function placeVoidAt(
  drawing: StaticBoardDrawing,
  coord: IHexCoordinates,
): StaticBoardDrawing {
  return withCell(drawing, coord, VOID_SYMBOL);
}

export function placeHexobjectAt(
  drawing: StaticBoardDrawing,
  coord: IHexCoordinates,
  hexobjectKey: THexobjectKey,
): StaticBoardDrawing {
  const entry: LegendEntry = { hexobjectKey };
  const letter = findOrAllocateLegendLetter(drawing.legend, entry);
  const legend = { ...drawing.legend, [letter]: entry };
  return withCell({ ...drawing, legend }, coord, letter);
}
