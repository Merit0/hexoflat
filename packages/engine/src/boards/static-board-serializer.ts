import type { LegendEntry, StaticBoardDrawing } from '../content/boards/schemas';
import { parseBoardRows } from './board-rows';
import { EXIT_SYMBOL, MOUNTAIN_SYMBOL, WATER_SYMBOL } from './board-symbols';

const GROUND_SYMBOL = '.';
const WALL_SYMBOL = '#';
const VOID_SYMBOL = '~';
const STRUCTURAL_SYMBOLS = new Set([
  GROUND_SYMBOL,
  WALL_SYMBOL,
  VOID_SYMBOL,
  MOUNTAIN_SYMBOL,
  WATER_SYMBOL,
  EXIT_SYMBOL,
]);

function constNameFor(id: string): string {
  return `${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_BOARD`;
}

function serializeJsValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(serializeJsValue).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{ ${entries.map(([key, val]) => `${key}: ${serializeJsValue(val)}`).join(', ')} }`;
  }
  return 'undefined';
}

function serializeLegendEntry(entry: LegendEntry): string {
  const parts = [`hexobjectKey: '${entry.hexobjectKey}'`];
  if (entry.overrides && Object.keys(entry.overrides).length > 0) {
    parts.push(`overrides: ${serializeJsValue(entry.overrides)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

function usedLegendLetters(grid: string[][]): Set<string> {
  const used = new Set<string>();
  for (const row of grid) {
    for (const symbol of row) {
      if (!STRUCTURAL_SYMBOLS.has(symbol)) used.add(symbol);
    }
  }
  return used;
}

function columnHeaderComment(width: number): string {
  const columns = Array.from({ length: width }, (_, i) => i);
  return `  // ${columns.join(' ')}`;
}

export function serializeStaticBoardDrawing(drawing: StaticBoardDrawing): string {
  const grid = parseBoardRows(drawing.rows);
  const used = usedLegendLetters(grid);
  const legendLetters = Object.keys(drawing.legend)
    .filter((letter) => used.has(letter))
    .sort();

  const legendBody = legendLetters
    .map((letter) => `    ${letter}: ${serializeLegendEntry(drawing.legend[letter])},`)
    .join('\n');

  const width = grid[0]?.length ?? 0;
  const rowsBody = grid
    .map((cells, rowIndex) => {
      const joined = rowIndex % 2 === 1 ? ` ${cells.join(' ')}` : cells.join(' ');
      const label = `r${String(rowIndex).padStart(2, '0')}`;
      return `    '${joined}', // ${label}`;
    })
    .join('\n');

  const constName = constNameFor(drawing.id);

  return `import type { StaticBoardDrawing } from '../schemas';

export const ${constName} = {
  id: '${drawing.id}',
  background: '${drawing.background}',
  legend: {
${legendBody}
  },
${columnHeaderComment(width)}
  rows: [
${rowsBody}
  ],
} satisfies StaticBoardDrawing;
`;
}
