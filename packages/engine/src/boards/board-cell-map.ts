import { coordinateKey } from '../utils/hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { ResolvedCell } from './resolved-cell';

/** Sparse working grid for assembling a generated board — an absent key means void (no tile). Keyed by coordinateKey, so it composes directly with hex-utils' neighbour helpers. */
export class BoardCellMap {
  private readonly cells = new Map<string, ResolvedCell>();

  set(coord: IHexCoordinates, cell: ResolvedCell): void {
    this.cells.set(coordinateKey(coord), cell);
  }

  get(coord: IHexCoordinates): ResolvedCell | undefined {
    return this.cells.get(coordinateKey(coord));
  }

  delete(coord: IHexCoordinates): void {
    this.cells.delete(coordinateKey(coord));
  }

  has(coord: IHexCoordinates): boolean {
    return this.cells.has(coordinateKey(coord));
  }

  entries(): IterableIterator<[string, ResolvedCell]> {
    return this.cells.entries();
  }
}

/** Inverse of hex-utils' coordinateKey (`col:row`). */
export function parseCoordinateKey(key: string): IHexCoordinates {
  const [columnIndex, rowIndex] = key.split(':').map(Number);
  return { columnIndex, rowIndex };
}
