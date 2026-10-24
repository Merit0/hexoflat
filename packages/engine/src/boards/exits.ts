import { coordinateKey } from '../utils/hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { EXIT_SYMBOL, VOID_SYMBOL } from './board-symbols';

export const EXIT_SIDES = ['N', 'S', 'W', 'E'] as const;
export type ExitSide = (typeof EXIT_SIDES)[number];

export const OPPOSITE_SIDE: Record<ExitSide, ExitSide> = { N: 'S', S: 'N', W: 'E', E: 'W' };

interface Extents {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
}

function shapeExtents(grid: string[][]): Extents | null {
  let extents: Extents | null = null;
  grid.forEach((cells, rowIndex) => {
    cells.forEach((symbol, columnIndex) => {
      if (symbol === VOID_SYMBOL) return;
      extents = extents
        ? {
            minRow: Math.min(extents.minRow, rowIndex),
            maxRow: Math.max(extents.maxRow, rowIndex),
            minColumn: Math.min(extents.minColumn, columnIndex),
            maxColumn: Math.max(extents.maxColumn, columnIndex),
          }
        : { minRow: rowIndex, maxRow: rowIndex, minColumn: columnIndex, maxColumn: columnIndex };
    });
  });
  return extents;
}

export function classifyExits(grid: string[][]): Map<string, ExitSide> {
  const sides = new Map<string, ExitSide>();
  const extents = shapeExtents(grid);
  if (!extents) return sides;

  grid.forEach((cells, rowIndex) => {
    cells.forEach((symbol, columnIndex) => {
      if (symbol !== EXIT_SYMBOL) return;
      const distances: Record<ExitSide, number> = {
        N: rowIndex - extents.minRow,
        S: extents.maxRow - rowIndex,
        W: columnIndex - extents.minColumn,
        E: extents.maxColumn - columnIndex,
      };
      const side = EXIT_SIDES.reduce((best, candidate) =>
        distances[candidate] < distances[best] ? candidate : best,
      );
      sides.set(coordinateKey({ columnIndex, rowIndex }), side);
    });
  });
  return sides;
}

export function exitSideAt(
  exits: Map<string, ExitSide>,
  coordinates: IHexCoordinates,
): ExitSide | undefined {
  return exits.get(coordinateKey(coordinates));
}
