import type { Axial } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { SeededRandom } from '../../../utils/random-seeded';

export type EntrySide = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
export interface Orientation {
  entrySide: EntrySide;
  mirror: 1 | -1;
}

const ENTRY_SIDES: EntrySide[] = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

/** D19: entry side and branch mirroring come from the seed, not always the same diagonal. */
export function pickOrientation(rng: SeededRandom): Orientation {
  const entrySide = ENTRY_SIDES[Math.floor(rng() * ENTRY_SIDES.length)];
  const mirror: 1 | -1 = rng() < 0.5 ? 1 : -1;
  return { entrySide, mirror };
}

/**
 * How far in from the board edge a node's STARTING centre is placed — not
 * a cap on how far growth may later reach. `growAreas` is free to expand
 * all the way to the true board boundary regardless of this value, so a
 * bigger margin here costs nothing against D17's fill share; what it does
 * fix is ENTRY (always depth 0 — local-layout.ts anchors it at the origin)
 * starting flush against the wall on one side, which forces its budgeted
 * growth to spread sideways along that wall instead of rounding out in
 * every direction — exactly the "too elongated" shape the compactness
 * check exists to catch. Centring the starting layout well clear of the
 * edge gives every direction room to grow before anything meets a real
 * boundary.
 */
const EDGE_MARGIN = 4;

/**
 * Scales the depth/lane layout (local-layout.ts) across the whole board,
 * oriented from the seed: depth runs from the entry side toward the
 * opposite side, lane runs across it. Centers are a starting point for area
 * growth, not exact placements — growth and link carving do the rest.
 */
export function scaleLayoutToBoard(
  positions: Map<string, Axial>,
  nodeIds: string[],
  orientation: Orientation,
  boardColumns: number,
  boardRows: number,
): Map<string, IHexCoordinates> {
  const relevant = nodeIds.map((id) => positions.get(id)).filter((p): p is Axial => !!p);
  const maxDepth = Math.max(0, ...relevant.map((p) => p.r));
  const minLane = Math.min(0, ...relevant.map((p) => p.q));
  const maxLane = Math.max(0, ...relevant.map((p) => p.q));
  const laneRange = maxLane - minLane;

  const depthAxisIsColumn = orientation.entrySide === 'LEFT' || orientation.entrySide === 'RIGHT';
  const depthAxisLength = depthAxisIsColumn ? boardColumns : boardRows;
  const laneAxisLength = depthAxisIsColumn ? boardRows : boardColumns;

  const depthSpan = depthAxisLength - EDGE_MARGIN * 2;
  const laneSpan = laneAxisLength - EDGE_MARGIN * 2;
  const depthStep = maxDepth > 0 ? depthSpan / maxDepth : 0;
  const laneStep = laneRange > 0 ? laneSpan / laneRange : 0;
  const laneMid = laneAxisLength / 2;

  const result = new Map<string, IHexCoordinates>();
  for (const nodeId of nodeIds) {
    const position = positions.get(nodeId);
    if (!position) continue;

    const laneOffset = (position.q - minLane - laneRange / 2) * laneStep * orientation.mirror;
    const laneCoord = Math.round(laneMid + laneOffset);

    let column: number;
    let row: number;
    switch (orientation.entrySide) {
      case 'LEFT':
        column = Math.round(EDGE_MARGIN + position.r * depthStep);
        row = laneCoord;
        break;
      case 'RIGHT':
        column = Math.round(boardColumns - 1 - EDGE_MARGIN - position.r * depthStep);
        row = laneCoord;
        break;
      case 'TOP':
        row = Math.round(EDGE_MARGIN + position.r * depthStep);
        column = laneCoord;
        break;
      case 'BOTTOM':
      default:
        row = Math.round(boardRows - 1 - EDGE_MARGIN - position.r * depthStep);
        column = laneCoord;
        break;
    }

    result.set(nodeId, {
      columnIndex: Math.min(Math.max(column, 0), boardColumns - 1),
      rowIndex: Math.min(Math.max(row, 0), boardRows - 1),
    });
  }
  return result;
}
