import { axialToOffset, coordinateKey, offsetToAxial } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { AreaLink } from './contract-path-segments';
import { hexLineAxial } from './hex-line';
import { keyToCoord } from './hex-key-utils';

interface LengthRange {
  min: number;
  max: number;
}

const NORMAL_LINK_LENGTH: LengthRange = { min: 1, max: 3 };
/** A link that passed through one or more PATH_SEGMENT nodes reads as a longer neck. */
const LONG_LINK_LENGTH: LengthRange = { min: 2, max: 4 };

function cubeDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/**
 * Picks the pair of border cells whose hex distance lands the carved bridge
 * inside `range` AND whose intermediate cells are all still free — NOT
 * simply the closest pair. `growAreas` packs any two areas as tightly as
 * their budgets allow (exactly one wall hex apart, the minimum `isEligible`
 * permits), so the single closest pair is almost always too short for a
 * "long" (PATH_SEGMENT-derived) link regardless of how far apart their
 * centres started. A big organic area has boundary cells at many distances
 * from its neighbour, though, so searching all pairs for one that already
 * lands in range — and doesn't clip through a third area's own hexes or an
 * already-carved link — is usually possible without needing to reshape
 * growth itself.
 */
function pickBridge(
  a: Set<string>,
  b: Set<string>,
  range: LengthRange,
  occupied: Set<string>,
  boardColumns: number,
  boardRows: number,
): IHexCoordinates[] | null {
  const candidates: { from: string; to: string; bridgeLength: number }[] = [];
  for (const aKey of a) {
    const aAxial = offsetToAxial(keyToCoord(aKey));
    for (const bKey of b) {
      const bAxial = offsetToAxial(keyToCoord(bKey));
      const bridgeLength = cubeDistance(aAxial, bAxial) - 1;
      if (bridgeLength < range.min || bridgeLength > range.max) continue;
      candidates.push({ from: aKey, to: bKey, bridgeLength });
    }
  }
  candidates.sort((x, y) => x.bridgeLength - y.bridgeLength);

  for (const candidate of candidates) {
    const line = hexLineAxial(
      offsetToAxial(keyToCoord(candidate.from)),
      offsetToAxial(keyToCoord(candidate.to)),
    );
    const bridge = line.slice(1, -1).map(axialToOffset);
    const inBounds = bridge.every(
      (coord) =>
        coord.columnIndex >= 0 &&
        coord.columnIndex < boardColumns &&
        coord.rowIndex >= 0 &&
        coord.rowIndex < boardRows,
    );
    if (!inBounds) continue;
    if (bridge.some((coord) => occupied.has(coordinateKey(coord)))) continue;
    return bridge;
  }

  return null;
}

export type CarveLinksResult =
  { ok: true; linkCells: Map<string, IHexCoordinates[]> } | { ok: false; reason: string };

/**
 * Carves one passage per graph edge between the two areas it connects — a
 * pair of border cells whose distance already lands the bridge inside its
 * allowed length and whose path is still empty, bridged with the same
 * `hexLineAxial` used for the old node-to-node corridors (D18: two areas
 * touch ONLY through this link, everywhere else stays walled by
 * construction from `growAreas`'s "no cell adjacent to another area" rule).
 * `occupied` starts as every area's own cells and grows with each link
 * already carved, so two links can never overlap each other or clip
 * through a third area's territory.
 */
export function carveLinks(
  links: AreaLink[],
  areaCells: Map<string, Set<string>>,
  boardColumns: number,
  boardRows: number,
  /** Cells reserved but not walkable-area membership — OBSTRUCTION/LANDMARK blocked clusters carved out of an area's own cells (embed-region.ts). A bridge must not clip through these either, even though they're no longer in `areaCells`. */
  alsoOccupied: Set<string> = new Set(),
): CarveLinksResult {
  const linkCells = new Map<string, IHexCoordinates[]>();
  const occupied = new Set<string>(alsoOccupied);
  for (const cells of areaCells.values()) {
    for (const key of cells) occupied.add(key);
  }

  for (const link of links) {
    const fromCells = areaCells.get(link.from);
    const toCells = areaCells.get(link.to);
    if (!fromCells || !toCells || fromCells.size === 0 || toCells.size === 0) {
      return { ok: false, reason: `link "${link.id}" references an area with no grown hexes` };
    }

    const range = link.isLong ? LONG_LINK_LENGTH : NORMAL_LINK_LENGTH;
    const bridge = pickBridge(fromCells, toCells, range, occupied, boardColumns, boardRows);
    if (!bridge) {
      return {
        ok: false,
        reason: `link "${link.id}" has no clear pair of border hexes between "${link.from}" and "${link.to}" whose distance lands the bridge in ${range.min}-${range.max} hexes`,
      };
    }

    for (const coord of bridge) occupied.add(coordinateKey(coord));
    linkCells.set(link.id, bridge);
  }

  return { ok: true, linkCells };
}
