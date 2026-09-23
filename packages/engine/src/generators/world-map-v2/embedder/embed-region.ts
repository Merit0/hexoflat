import {
  AXIAL_DIRS,
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  offsetToAxial,
} from '../../../utils/hex-utils';
import type { Axial } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { RegionTopologyGraph } from '../region-topology';
import type { EmbedResult, EmbeddedHex, EmbeddedHexOwner } from '../embedded-board';
import { computeOpenNodeLayout } from './local-layout';
import { hexLineAxial } from './hex-line';
import { verifyEmbeddingConnectivity } from './verify-embedding';

interface LocalCell {
  position: Axial;
  owner: EmbeddedHexOwner;
  passable: boolean;
}

type StepResult = { ok: true } | { ok: false; reason: string };

function axialKey(a: Axial): string {
  return `${a.q}:${a.r}`;
}

function describeOwner(owner: EmbeddedHexOwner): string {
  if (owner.kind === 'NODE') return `node "${owner.nodeId}"`;
  if (owner.kind === 'EDGE') return `edge "${owner.edgeId}"`;
  return 'shell';
}

/**
 * Whether a second claim on an already-placed hex is a real contradiction
 * or just two things that happen to explain the same hex. Two branches
 * converging on a MERGE/LANDMARK node can legitimately fill their last gap
 * through the exact same hex — that's a real geometric coincidence (the
 * point equidistant from both approaches), not a layout bug, so two
 * different `EDGE`s (or an `EDGE` and a `NODE`) sharing a passable hex is
 * fine: the hex still has a reason to exist, it just has more than one. The
 * only genuine conflicts are a hex that can't decide whether it's walkable,
 * and two different `NODE`s claiming to be the same place.
 */
function isRealConflict(
  existing: LocalCell,
  incomingOwner: EmbeddedHexOwner,
  incomingPassable: boolean,
): boolean {
  if (existing.passable !== incomingPassable) return true;
  if (existing.owner.kind === 'NODE' && incomingOwner.kind === 'NODE') {
    return existing.owner.nodeId !== incomingOwner.nodeId;
  }
  return false;
}

function placeCell(
  cellsByKey: Map<string, LocalCell>,
  position: Axial,
  owner: EmbeddedHexOwner,
  passable: boolean,
): StepResult {
  const key = axialKey(position);
  const existing = cellsByKey.get(key);
  if (existing) {
    if (isRealConflict(existing, owner, passable)) {
      return {
        ok: false,
        reason: `local layout collision at (${position.q}, ${position.r}) between ${describeOwner(existing.owner)} and ${describeOwner(owner)}`,
      };
    }
    return { ok: true };
  }
  cellsByKey.set(key, { position, owner, passable });
  return { ok: true };
}

function findFreeAdjacentCell(cellsByKey: Map<string, LocalCell>, anchor: Axial): Axial | null {
  for (const dir of AXIAL_DIRS) {
    const candidate = { q: anchor.q + dir.q, r: anchor.r + dir.r };
    if (!cellsByKey.has(axialKey(candidate))) return candidate;
  }
  return null;
}

/**
 * Places every node reachable from ENTRY (one hex each), every OBSTRUCTION
 * next to its host, and fills every OPEN edge's gap with EDGE-owned hexes —
 * all in local axial space, with no rng and no board bounds involved yet.
 */
function placeGraphCells(
  graph: RegionTopologyGraph,
  openPositions: Map<string, Axial>,
): { ok: true; cells: Map<string, LocalCell> } | { ok: false; reason: string } {
  const cellsByKey = new Map<string, LocalCell>();

  for (const [nodeId, position] of openPositions) {
    const result = placeCell(cellsByKey, position, { kind: 'NODE', nodeId }, true);
    if (!result.ok) return result;
  }

  for (const edge of graph.edges) {
    if (edge.traversal !== 'BLOCKED') continue;
    const hostPosition = openPositions.get(edge.from);
    if (!hostPosition) {
      return { ok: false, reason: `obstruction host "${edge.from}" has no placed position` };
    }
    const spot = findFreeAdjacentCell(cellsByKey, hostPosition);
    if (!spot) {
      return {
        ok: false,
        reason: `no free hex next to "${edge.from}" to place obstruction "${edge.to}"`,
      };
    }
    const result = placeCell(cellsByKey, spot, { kind: 'NODE', nodeId: edge.to }, false);
    if (!result.ok) return result;
  }

  for (const edge of graph.edges) {
    if (edge.traversal !== 'OPEN') continue;
    const from = openPositions.get(edge.from);
    const to = openPositions.get(edge.to);
    if (!from || !to) {
      return { ok: false, reason: `edge "${edge.id}" references an unplaced node` };
    }

    for (const point of hexLineAxial(from, to).slice(1, -1)) {
      const result = placeCell(cellsByKey, point, { kind: 'EDGE', edgeId: edge.id }, true);
      if (!result.ok) return result;
    }
  }

  return { ok: true, cells: cellsByKey };
}

/**
 * Centres the local layout on the board — shifting it in AXIAL space, not
 * by adding a flat offset to columnIndex/rowIndex afterwards: odd-r offset
 * columns depend on the row's parity (`columnIndex = q + floor(r/2)`), so
 * translating row/column independently in offset space silently breaks
 * adjacency for every cell whose row parity the shift happens to flip. An
 * axial shift has no such parity trap — it preserves hex-adjacency for any
 * integer delta. Then builds the one-cell `SHELL` ring around the result.
 */
function placeOntoBoard(
  cells: Map<string, LocalCell>,
  boardColumns: number,
  boardRows: number,
): { ok: true; hexes: EmbeddedHex[] } | { ok: false; reason: string } {
  const localPositions = [...cells.values()].map((cell) => cell.position);
  const localCenter = {
    q: Math.round(
      (Math.min(...localPositions.map((p) => p.q)) + Math.max(...localPositions.map((p) => p.q))) /
        2,
    ),
    r: Math.round(
      (Math.min(...localPositions.map((p) => p.r)) + Math.max(...localPositions.map((p) => p.r))) /
        2,
    ),
  };
  const boardCenterAxial = offsetToAxial({
    columnIndex: Math.floor(boardColumns / 2),
    rowIndex: Math.floor(boardRows / 2),
  });
  const deltaQ = boardCenterAxial.q - localCenter.q;
  const deltaR = boardCenterAxial.r - localCenter.r;

  const hexes: EmbeddedHex[] = [...cells.values()].map((cell) => ({
    coordinates: axialToOffset({ q: cell.position.q + deltaQ, r: cell.position.r + deltaR }),
    owner: cell.owner,
    passable: cell.passable,
  }));

  const minCol = Math.min(...hexes.map((hex) => hex.coordinates.columnIndex));
  const maxCol = Math.max(...hexes.map((hex) => hex.coordinates.columnIndex));
  const minRow = Math.min(...hexes.map((hex) => hex.coordinates.rowIndex));
  const maxRow = Math.max(...hexes.map((hex) => hex.coordinates.rowIndex));

  // A 1-cell margin on every side is reserved for the shell (D-rule §2.6.2)
  // so the shell never needs to be clipped against the board edge.
  if (minCol < 1 || maxCol > boardColumns - 2 || minRow < 1 || maxRow > boardRows - 2) {
    return {
      ok: false,
      reason: `graph footprint at (${minCol}..${maxCol}, ${minRow}..${maxRow}) does not fit the ${boardColumns}x${boardRows} board even with a shell margin`,
    };
  }

  const footprintKeys = new Set(hexes.map((hex) => coordinateKey(hex.coordinates)));
  const shellKeys = new Set<string>();
  for (const hex of hexes) {
    for (const neighbor of getHexNeighbors(hex.coordinates)) {
      if (neighbor.columnIndex < 0 || neighbor.columnIndex >= boardColumns) continue;
      if (neighbor.rowIndex < 0 || neighbor.rowIndex >= boardRows) continue;
      const key = coordinateKey(neighbor);
      if (!footprintKeys.has(key)) shellKeys.add(key);
    }
  }
  for (const key of shellKeys) {
    const [columnIndex, rowIndex] = key.split(':').map(Number);
    hexes.push({
      coordinates: { columnIndex, rowIndex },
      owner: { kind: 'SHELL' },
      passable: false,
    });
  }

  return { ok: true, hexes };
}

function buildAnchorIndex(hexes: EmbeddedHex[]): Map<string, EmbeddedHex> {
  const anchorHexByNodeId = new Map<string, EmbeddedHex>();
  for (const hex of hexes) {
    if (hex.owner.kind === 'NODE' && !anchorHexByNodeId.has(hex.owner.nodeId)) {
      anchorHexByNodeId.set(hex.owner.nodeId, hex);
    }
  }
  return anchorHexByNodeId;
}

function buildPortals(
  graph: RegionTopologyGraph,
  anchorHexByNodeId: Map<string, EmbeddedHex>,
): { nodeId: string; coordinates: IHexCoordinates }[] {
  return graph.nodes
    .filter((node) => node.role === 'PORTAL')
    .map((node) => {
      const hex = anchorHexByNodeId.get(node.id);
      return hex ? { nodeId: node.id, coordinates: hex.coordinates } : null;
    })
    .filter(
      (portal): portal is { nodeId: string; coordinates: IHexCoordinates } => portal !== null,
    );
}

/**
 * Embeds a linted `RegionTopologyGraph` into a fixed-size hex rectangle
 * (docs/WORLD-MAP-GENERATOR-V2-PLAN.md G2). Deliberately simplified in this
 * first pass: every node gets exactly one hex regardless of role (no
 * BASIN-wide/LANDMARK-big inflation yet — that's a visual richness the G3
 * review can call for without touching this function's contract), except an
 * `OBSTRUCTION` node, which is placed as its own separate, impassable hex
 * next to the node it's `BLOCKED`-attached to. Never stretches or resizes
 * the board — a graph that doesn't fit is a rejection, not a reason to grow
 * the rectangle (D10, D11).
 */
export function embedRegion(input: {
  graph: RegionTopologyGraph;
  boardColumns: number;
  boardRows: number;
}): EmbedResult {
  const { graph, boardColumns, boardRows } = input;

  const entryNode = graph.nodes.find((node) => node.role === 'ENTRY');
  if (!entryNode) return { ok: false, reason: 'graph has no ENTRY node to anchor the layout' };

  const openPositions = computeOpenNodeLayout(graph, entryNode.id);

  const placed = placeGraphCells(graph, openPositions);
  if (!placed.ok) return placed;

  const boarded = placeOntoBoard(placed.cells, boardColumns, boardRows);
  if (!boarded.ok) return boarded;

  const anchorHexByNodeId = buildAnchorIndex(boarded.hexes);
  const verification = verifyEmbeddingConnectivity(graph, boarded.hexes, anchorHexByNodeId);
  if (!verification.ok) return verification;

  const portals = buildPortals(graph, anchorHexByNodeId);

  return { ok: true, board: { boardColumns, boardRows, hexes: boarded.hexes, portals } };
}
