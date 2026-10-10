import { offsetToAxial, axialToOffset, type Axial } from '../utils/hex-utils';
import type {
  BoardChunk,
  BoardLayout,
  GeneratedBoardPreset,
  StaticBoardDrawing,
} from '../content/boards/schemas';
import { parseBoardRows, boardRowsAreRectangular } from './board-rows';
import { zoneFitsFrame, zonesOverlap } from './layout-zones';
import { computeZoneRequirement } from './zone-placement';
import { findChunkCandidates } from './chunk-placement';
import {
  DOOR_SYMBOL,
  ENEMY_SLOT_SYMBOL,
  ENTRY_SYMBOL,
  GROUND_SYMBOL,
  POI_SLOT_SYMBOL,
  RANDOM_SYMBOL,
  RESOURCE_SLOT_SYMBOL,
  VOID_SYMBOL,
  WALL_SYMBOL,
} from './board-symbols';

const STATIC_SYMBOLS = new Set([GROUND_SYMBOL, WALL_SYMBOL, VOID_SYMBOL]);
const CHUNK_STRUCTURAL_SYMBOLS = new Set([
  GROUND_SYMBOL,
  WALL_SYMBOL,
  RANDOM_SYMBOL,
  DOOR_SYMBOL,
  ENTRY_SYMBOL,
  RESOURCE_SLOT_SYMBOL,
  POI_SLOT_SYMBOL,
  ENEMY_SLOT_SYMBOL,
]);
const EDGE_ONLY_SYMBOLS = new Set([DOOR_SYMBOL, ENTRY_SYMBOL]);

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

function localHexNeighbors(column: number, row: number): { column: number; row: number }[] {
  const axial = offsetToAxial({ columnIndex: column, rowIndex: row });
  const dirs: Axial[] = [
    { q: axial.q + 1, r: axial.r },
    { q: axial.q + 1, r: axial.r - 1 },
    { q: axial.q, r: axial.r - 1 },
    { q: axial.q - 1, r: axial.r },
    { q: axial.q - 1, r: axial.r + 1 },
    { q: axial.q, r: axial.r + 1 },
  ];
  return dirs.map((a) => {
    const offset = axialToOffset(a);
    return { column: offset.columnIndex, row: offset.rowIndex };
  });
}

function checkChunkConnectivity(chunk: BoardChunk, grid: string[][]): string[] {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const isPassable = (c: number, r: number) =>
    grid[r]?.[c] !== undefined && grid[r][c] !== WALL_SYMBOL;

  let start: { column: number; row: number } | undefined;
  for (let r = 0; r < height && !start; r += 1) {
    for (let c = 0; c < width && !start; c += 1) {
      if (isPassable(c, r)) start = { column: c, row: r };
    }
  }
  if (!start) return [`chunk "${chunk.id}": has no passable cell at all`];

  const reached = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const current = queue.shift() as { column: number; row: number };
    const key = `${current.column}:${current.row}`;
    if (reached.has(key)) continue;
    reached.add(key);
    for (const neighbor of localHexNeighbors(current.column, current.row)) {
      if (
        neighbor.column < 0 ||
        neighbor.column >= width ||
        neighbor.row < 0 ||
        neighbor.row >= height
      )
        continue;
      if (isPassable(neighbor.column, neighbor.row)) queue.push(neighbor);
    }
  }

  let totalPassable = 0;
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) if (isPassable(c, r)) totalPassable += 1;
  }

  return reached.size === totalPassable
    ? []
    : [`chunk "${chunk.id}": not every passable cell (including doors) is connected`];
}

export function lintChunk(chunk: BoardChunk): string[] {
  const issues: string[] = [];
  const grid = parseBoardRows(chunk.rows);
  const width = grid[0]?.length ?? 0;
  const height = grid.length;

  if (!boardRowsAreRectangular(grid)) issues.push(`chunk "${chunk.id}": rows are not rectangular`);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const symbol = grid[row][column];
      if (CHUNK_STRUCTURAL_SYMBOLS.has(symbol)) {
        const isEdge = row === 0 || row === height - 1 || column === 0 || column === width - 1;
        if (EDGE_ONLY_SYMBOLS.has(symbol) && !isEdge) {
          issues.push(`chunk "${chunk.id}": "${symbol}" at (${column},${row}) is not on an edge`);
        }
        continue;
      }
      if (!chunk.legend?.[symbol]) {
        issues.push(`chunk "${chunk.id}": symbol "${symbol}" has no legend entry`);
      }
    }
  }

  return [...issues, ...checkChunkConnectivity(chunk, grid)];
}

export function lintLayout(layout: BoardLayout, boardColumns: number, boardRows: number): string[] {
  const issues: string[] = [];
  const zoneIds = new Set(layout.zones.map((z) => z.id));

  for (const zone of layout.zones) {
    if (!zoneFitsFrame(zone, boardColumns, boardRows)) {
      issues.push(
        `layout "${layout.id}": zone "${zone.id}" does not fit the ${boardColumns}x${boardRows} frame`,
      );
    }
    if (zone.row % 2 !== 0) {
      issues.push(`layout "${layout.id}": zone "${zone.id}" must start on an even row`);
    }
  }

  for (let i = 0; i < layout.zones.length; i += 1) {
    for (let j = i + 1; j < layout.zones.length; j += 1) {
      if (zonesOverlap(layout.zones[i], layout.zones[j])) {
        issues.push(
          `layout "${layout.id}": zones "${layout.zones[i].id}" and "${layout.zones[j].id}" overlap`,
        );
      }
    }
  }

  if (!zoneIds.has(layout.entryZone)) {
    issues.push(`layout "${layout.id}": entryZone "${layout.entryZone}" is not a known zone`);
  }
  for (const link of layout.links) {
    if (!zoneIds.has(link.from))
      issues.push(`layout "${layout.id}": link references unknown zone "${link.from}"`);
    if (!zoneIds.has(link.to))
      issues.push(`layout "${layout.id}": link references unknown zone "${link.to}"`);
  }

  return issues;
}

export function lintPresetChunkAvailability(
  preset: GeneratedBoardPreset,
  layouts: BoardLayout[],
  chunks: BoardChunk[],
): string[] {
  const issues: string[] = [];

  for (const layoutId of preset.layouts) {
    const layout = layouts.find((l) => l.id === layoutId);
    if (!layout) {
      issues.push(`preset "${preset.id}": references unknown layout "${layoutId}"`);
      continue;
    }

    for (const zone of layout.zones) {
      const requirement = computeZoneRequirement(zone, layout, preset.biome);
      if (findChunkCandidates(chunks, requirement).length === 0) {
        issues.push(
          `preset "${preset.id}": no ${preset.biome} chunk fits zone "${zone.id}" of layout "${layoutId}"`,
        );
      }
      if (!preset.fallbackChunks[layoutId]?.[zone.id]) {
        issues.push(
          `preset "${preset.id}": fallbackChunks is missing zone "${zone.id}" of layout "${layoutId}"`,
        );
      }
    }
  }

  return issues;
}
