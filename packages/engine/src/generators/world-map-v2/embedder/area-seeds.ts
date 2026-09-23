import { axialToOffset, coordinateKey, offsetToAxial } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { AreaLink } from './contract-path-segments';
import { hexLineAxial } from './hex-line';

/** Reserved at the midpoint of every link so growth never has to close a zero-hex gap. Long links reserve more, matching their wider allowed bridge length. */
const NORMAL_GAP = 2;
const LONG_GAP = 3;
/** Caps how far any single arm reaches, so a multi-link area's seed stays small enough for growth to round it back into one place. */
const ARM_CAP = 1;

/**
 * Extra cells each area starts growth from, reaching most of the way
 * toward each of its linked neighbours along the straight line between
 * their centres — split down the middle so the two sides never overlap,
 * with a small gap reserved at the midpoint for the link `carveLinks` cuts
 * later. Plain budgeted growth (a single point blobbing outward preferring
 * local compactness) has no sense of direction and can end up nowhere near
 * the specific neighbour a link is supposed to reach; seeding a spine
 * toward every neighbour up front means growth thickens around a shape
 * that already reaches close to where it needs to, instead of hoping
 * proximity happens by chance.
 */
export function computeAreaSeedCells(
  centers: Map<string, IHexCoordinates>,
  links: AreaLink[],
  boardColumns: number,
  boardRows: number,
): Map<string, Set<string>> {
  function inBounds(coord: IHexCoordinates): boolean {
    return (
      coord.columnIndex >= 0 &&
      coord.columnIndex < boardColumns &&
      coord.rowIndex >= 0 &&
      coord.rowIndex < boardRows
    );
  }

  const seeds = new Map<string, Set<string>>();
  for (const [nodeId, center] of centers) {
    seeds.set(nodeId, new Set([coordinateKey(center)]));
  }

  for (const link of links) {
    const fromCenter = centers.get(link.from);
    const toCenter = centers.get(link.to);
    if (!fromCenter || !toCenter) continue;

    const line = hexLineAxial(offsetToAxial(fromCenter), offsetToAxial(toCenter));
    const gap = link.isLong ? LONG_GAP : NORMAL_GAP;
    if (line.length <= gap + 2) continue; // too short to reserve a gap — growth alone will handle it

    // A short, fixed-length nudge toward the neighbour — enough to break
    // the tie in BFS growth so the area's natural expansion leans toward
    // where it needs to connect, without making the seed itself so long
    // that no amount of later thickening can round it back out (a fork
    // with links in 3 different directions would otherwise start as a
    // 3-armed star wider than its own budget allows filling in). A centre
    // near the board edge (D19 orientation allows that) can still put an
    // arm cell out of bounds — skipped rather than clamped, since clamping
    // would silently fold two different cells onto the same coordinate.
    const armLength = Math.min(ARM_CAP, Math.floor((line.length - gap) / 2) - 1);

    const fromSeeds = seeds.get(link.from);
    for (let i = 1; i <= armLength; i += 1) {
      const coord = axialToOffset(line[i]);
      if (inBounds(coord)) fromSeeds?.add(coordinateKey(coord));
    }

    const toSeeds = seeds.get(link.to);
    for (let i = 1; i <= armLength; i += 1) {
      const coord = axialToOffset(line[line.length - 1 - i]);
      if (inBounds(coord)) toSeeds?.add(coordinateKey(coord));
    }
  }

  return seeds;
}
