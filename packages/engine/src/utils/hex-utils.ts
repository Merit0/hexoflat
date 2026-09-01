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

export function oddQToAxial(c: IHexCoordinates): Axial {
  const q = c.columnIndex;
  const r = c.rowIndex - (q - (q & 1)) / 2;
  return { q, r };
}

export function axialToOddQ(a: { q: number; r: number }): IHexCoordinates {
  const columnIndex = a.q;
  const rowIndex = a.r + (columnIndex - (columnIndex & 1)) / 2;
  return { columnIndex, rowIndex };
}

export const AXIAL_DIRS = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
] as const;

function wrapDir(dir: number): number {
  return ((dir % 6) + 6) % 6;
}

function noNegativeZero(n: number): number {
  return n === 0 ? 0 : n;
}

export function getOddQNeighbors(center: IHexCoordinates): IHexCoordinates[] {
  const a = oddQToAxial(center);
  return AXIAL_DIRS.map((d) => axialToOddQ({ q: a.q + d.q, r: a.r + d.r }));
}

export function axialNeighbor(a: Axial, dir: number): Axial {
  const d = AXIAL_DIRS[wrapDir(dir)];
  return { q: a.q + d.q, r: a.r + d.r };
}

export function oppositeDir(dir: number): number {
  return wrapDir(dir + 3);
}

export function rotateAxial(a: Axial, steps: number): Axial {
  let { q, r } = a;
  for (let i = wrapDir(steps); i > 0; i -= 1) {
    [q, r] = [-r, q + r];
  }
  return { q: noNegativeZero(q), r: noNegativeZero(r) };
}

export function rotateDir(dir: number, steps: number): number {
  const rotated = rotateAxial(AXIAL_DIRS[wrapDir(dir)], steps);
  return AXIAL_DIRS.findIndex((d) => d.q === rotated.q && d.r === rotated.r);
}

export function coordinateKey(c: IHexCoordinates): string {
  return `${c.columnIndex}:${c.rowIndex}`;
}

export function hexDistance(from: IHexCoordinates, to: IHexCoordinates): number {
  const a = oddQToAxial(from);
  const b = oddQToAxial(to);

  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);

  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/**
 * Odd-q offset flat-top tiling, in terms of the tile's actual rendered box
 * (`width`/`height`) rather than a separately-tuned "tileWidth" constant.
 * Passing the real rendered box size — the same value every caller uses to
 * size the tile itself — is what guarantees adjacent hexes tile with zero
 * gap/overlap: any mismatch between "how big a tile is drawn" and "how far
 * apart tiles are placed" shows up as visible seams or overlap.
 */
export function calcHexPixelPosition(tile: IHexPositioned, width: number, height: number) {
  const q = tile.coordinates.columnIndex;
  const r = tile.coordinates.rowIndex;

  const x = width * 0.75 * q;
  const y = height * (r + (q % 2 ? 0.5 : 0));

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
