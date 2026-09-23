import { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';

export type Axial = { q: number; r: number };

/**
 * Anything that can be pixel-positioned on the hex grid.
 * Deliberately narrower than IHexTile (Interface Segregation) so callers
 * that only have coordinates (previews, markers, pseudo-tiles) don't need
 * `as any` casts to a full tile model just to compute a position.
 */
export interface IHexPositioned {
  coordinates: IHexCoordinates;
}

export function offsetToAxial(c: IHexCoordinates): Axial {
  const r = c.rowIndex;
  const q = c.columnIndex - (r - (r & 1)) / 2;
  return { q, r };
}

function axialToOffset(a: { q: number; r: number }): IHexCoordinates {
  const rowIndex = a.r;
  const columnIndex = a.q + (rowIndex - (rowIndex & 1)) / 2;
  return { columnIndex, rowIndex };
}

const AXIAL_DIRS = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
] as const;

export function getHexNeighbors(center: IHexCoordinates): IHexCoordinates[] {
  const a = offsetToAxial(center);
  return AXIAL_DIRS.map((d) => axialToOffset({ q: a.q + d.q, r: a.r + d.r }));
}

export function coordinateKey(c: IHexCoordinates): string {
  return `${c.columnIndex}:${c.rowIndex}`;
}

export function hexDistance(from: IHexCoordinates, to: IHexCoordinates): number {
  const a = offsetToAxial(from);
  const b = offsetToAxial(to);

  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);

  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/**
 * Odd-r offset pointy-top tiling, in terms of the tile's actual rendered box
 * (`width` = flat-side to flat-side, `height` = vertex to vertex) rather than
 * a separately-tuned constant. Passing the real rendered box size — the same
 * value every caller uses to size the tile itself — is what guarantees
 * adjacent hexes tile with zero gap/overlap: any mismatch between "how big a
 * tile is drawn" and "how far apart tiles are placed" shows up as visible
 * seams or overlap.
 */
export function calcHexPixelPosition(tile: IHexPositioned, width: number, height: number) {
  const col = tile.coordinates.columnIndex;
  const row = tile.coordinates.rowIndex;

  const x = width * (col + (row & 1 ? 0.5 : 0));
  const y = height * 0.75 * row;

  return { x, y };
}

/** size = "radius" гекса (від центру до вершини) */
export function axialToPixelPointy({ q, r }: Axial, size: number) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}

export function axialToPixelFlat({ q, r }: Axial, size: number) {
  const x = size * (3 / 2) * q;
  const y = size * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}
