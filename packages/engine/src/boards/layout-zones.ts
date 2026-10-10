import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { BoardEdge, BoardZone } from '../content/boards/schemas';

export function zoneFitsFrame(zone: BoardZone, boardColumns: number, boardRows: number): boolean {
  return (
    zone.col >= 0 &&
    zone.row >= 0 &&
    zone.col + zone.width <= boardColumns &&
    zone.row + zone.height <= boardRows
  );
}

export function zonesOverlap(a: BoardZone, b: BoardZone): boolean {
  const colsOverlap = a.col < b.col + b.width && b.col < a.col + a.width;
  const rowsOverlap = a.row < b.row + b.height && b.row < a.row + a.height;
  return colsOverlap && rowsOverlap;
}

export function zoneToFrameCoord(
  zone: BoardZone,
  localColumn: number,
  localRow: number,
): IHexCoordinates {
  return { columnIndex: zone.col + localColumn, rowIndex: zone.row + localRow };
}

/** Local (column, row) pairs along one edge of a `width`x`height` chunk grid. */
export function edgeLocalCells(
  width: number,
  height: number,
  edge: BoardEdge,
): { column: number; row: number }[] {
  switch (edge) {
    case 'N':
      return Array.from({ length: width }, (_, column) => ({ column, row: 0 }));
    case 'S':
      return Array.from({ length: width }, (_, column) => ({ column, row: height - 1 }));
    case 'W':
      return Array.from({ length: height }, (_, row) => ({ column: 0, row }));
    case 'E':
      return Array.from({ length: height }, (_, row) => ({ column: width - 1, row }));
  }
}
