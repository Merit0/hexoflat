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

// odd-q offset -> axial
export function oddQToAxial(c: IHexCoordinates): Axial {
  const q = c.columnIndex;
  const r = c.rowIndex - (q - (q & 1)) / 2;
  return { q, r };
}

// axial -> odd-q offset
function axialToOddQ(a: { q: number; r: number }): IHexCoordinates {
  const columnIndex = a.q;
  const rowIndex = a.r + (columnIndex - (columnIndex & 1)) / 2;
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

export function getOddQNeighbors(center: IHexCoordinates): IHexCoordinates[] {
  const a = oddQToAxial(center);
  return AXIAL_DIRS.map((d) => axialToOddQ({ q: a.q + d.q, r: a.r + d.r }));
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

export function calcHexPixelPosition(tile: IHexPositioned, tileWidth: number, spacing = 0.93) {
  const q = tile.coordinates.columnIndex;
  const r = tile.coordinates.rowIndex;

  const x = tileWidth * 1.5 * spacing * q;
  const y = tileWidth * Math.sqrt(3) * spacing * (r + (q % 2 ? 0.5 : 0));

  return { x, y };
}

/**
 * Builds a ready-to-use `{ transform: translate(...) }` style object for a
 * hex-positioned element. Centralizes a pattern that used to be re-typed in
 * every component that places something on the hex grid (hero token, move
 * preview markers, camp-heal effect, etc).
 */
export function hexTranslateStyle(
  coord: IHexCoordinates,
  tileWidth: number,
  options: { round?: boolean } = {},
): Record<string, string> {
  const { x, y } = calcHexPixelPosition({ coordinates: coord }, tileWidth);
  const px = options.round ? Math.round(x) : x;
  const py = options.round ? Math.round(y) : y;

  return {
    transform: `translate(${px}px, ${py}px)`,
  };
}

/**
 * Pointy-top axial → pixel.
 * size = "radius" гекса (від центру до вершини)
 */
export function axialToPixelPointy({ q, r }: Axial, size: number) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}

/**
 * Flat-top axial → pixel.
 */
export function axialToPixelFlat({ q, r }: Axial, size: number) {
  const x = size * (3 / 2) * q;
  const y = size * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}
