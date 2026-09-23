import { coordinateKey, getHexNeighbors, hexDistance } from '../../../utils/hex-utils';
import { deriveStream } from '../../../utils/random-seeded';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { RegionTopologyGraph } from '../region-topology';
import type { BoardGenerationProfile } from '../board-seed';
import type { EmbedResult, EmbeddedHex } from '../embedded-board';
import { computeOpenNodeLayout } from './local-layout';
import { contractPathSegments, type ContractedGraph } from './contract-path-segments';
import { pickOrientation, scaleLayoutToBoard, type Orientation } from './orientation';
import { computeAreaBudgets, FILL_SHARE_RANGE } from './area-weights';
import { computeAreaSeedCells } from './area-seeds';
import { growAreas } from './area-growth';
import { carveBlockedCluster } from './area-obstructions';
import { carveLinks, type CarveLinksResult } from './area-links';
import { verifyAreaLinksConnectivity } from './verify-embedding';
import { verifyForksMeaningfulInHexes } from './verify-hex-forks';
import { keyToCoord } from './hex-key-utils';

export interface EmbedRegionInput {
  graph: RegionTopologyGraph;
  boardColumns: number;
  boardRows: number;
  profile: BoardGenerationProfile;
  embedSeed: string;
}

type Failure = { ok: false; reason: string };
type AreaCells = Map<string, Set<string>>;

function layoutAreaCenters(
  graph: RegionTopologyGraph,
  boardColumns: number,
  boardRows: number,
  embedSeed: string,
):
  | {
      ok: true;
      contracted: ContractedGraph;
      centers: Map<string, IHexCoordinates>;
      orientation: Orientation;
    }
  | Failure {
  const entryNode = graph.nodes.find((node) => node.role === 'ENTRY');
  if (!entryNode) return { ok: false, reason: 'graph has no ENTRY node to anchor the layout' };

  const contracted = contractPathSegments(graph);
  const areaNodeIds = contracted.areaNodes.map((node) => node.id);

  const localPositions = computeOpenNodeLayout(graph, entryNode.id);
  const orientation = pickOrientation(deriveStream(embedSeed, 'orientation'));
  const centers = scaleLayoutToBoard(
    localPositions,
    areaNodeIds,
    orientation,
    boardColumns,
    boardRows,
  );

  for (const id of areaNodeIds) {
    if (!centers.has(id)) return { ok: false, reason: `area "${id}" has no local layout position` };
  }

  return { ok: true, contracted, centers, orientation };
}

function growAndCarveAreas(
  contracted: ContractedGraph,
  centers: Map<string, IHexCoordinates>,
  profile: BoardGenerationProfile,
  boardColumns: number,
  boardRows: number,
  embedSeed: string,
): { ok: true; passableByArea: AreaCells; blockedByOwner: AreaCells } | Failure {
  const obstructionHostIds = new Set(contracted.obstructionByHost.keys());
  const { budgets } = computeAreaBudgets(
    contracted.areaNodes,
    obstructionHostIds,
    profile,
    boardColumns * boardRows,
    deriveStream(embedSeed, 'budget'),
  );

  const seedCells = computeAreaSeedCells(centers, contracted.links, boardColumns, boardRows);
  const grown = growAreas(
    seedCells,
    budgets,
    boardColumns,
    boardRows,
    deriveStream(embedSeed, 'growth'),
  );
  if (!grown.ok) return grown;

  const passableByArea: AreaCells = new Map();
  for (const [nodeId, cells] of grown.claimed) passableByArea.set(nodeId, new Set(cells));
  const blockedByOwner: AreaCells = new Map();

  for (const [hostId, obstructionNodeId] of contracted.obstructionByHost) {
    const hostCells = passableByArea.get(hostId);
    if (!hostCells) return { ok: false, reason: `obstruction host "${hostId}" was never grown` };

    const carved = carveBlockedCluster(
      hostCells,
      centers.get(hostId) as IHexCoordinates,
      Math.max(1, Math.round(hostCells.size * 0.15)),
    );
    if (!carved.ok) return carved;

    for (const key of carved.blocked) hostCells.delete(key);
    blockedByOwner.set(obstructionNodeId, carved.blocked);
  }

  for (const node of contracted.areaNodes) {
    if (node.role !== 'LANDMARK') continue;
    const cells = passableByArea.get(node.id) as Set<string>;

    const carved = carveBlockedCluster(
      cells,
      centers.get(node.id) as IHexCoordinates,
      Math.max(1, Math.round(cells.size * 0.2)),
    );
    if (!carved.ok) return carved;

    for (const key of carved.blocked) cells.delete(key);
    blockedByOwner.set(node.id, carved.blocked);
  }

  return { ok: true, passableByArea, blockedByOwner };
}

function checkAreaCompactness(passableByArea: AreaCells): { ok: true } | Failure {
  for (const [nodeId, cells] of passableByArea) {
    if (cells.size <= 1) continue;
    const coords = [...cells].map(keyToCoord);
    let maxDistance = 0;
    for (let i = 0; i < coords.length; i += 1) {
      for (let j = i + 1; j < coords.length; j += 1) {
        maxDistance = Math.max(maxDistance, hexDistance(coords[i], coords[j]));
      }
    }
    const bound = 1.5 * Math.sqrt(cells.size) + 2;
    if (maxDistance > bound) {
      return {
        ok: false,
        reason: `area "${nodeId}" spans ${maxDistance} hexes end to end, too elongated for its ${cells.size}-hex size (bound ${bound.toFixed(1)})`,
      };
    }
  }
  return { ok: true };
}

function checkFillShare(
  passableByArea: AreaCells,
  linksResult: Extract<CarveLinksResult, { ok: true }>,
  profile: BoardGenerationProfile,
  boardColumns: number,
  boardRows: number,
): { ok: true } | Failure {
  const totalPassable =
    [...passableByArea.values()].reduce((sum, cells) => sum + cells.size, 0) +
    [...linksResult.linkCells.values()].reduce((sum, cells) => sum + cells.length, 0);
  const passableShare = totalPassable / (boardColumns * boardRows);
  const [shareMin, shareMax] = FILL_SHARE_RANGE[profile];
  const shareTolerance = 0.15;

  if (passableShare < shareMin - shareTolerance || passableShare > shareMax + shareTolerance) {
    return {
      ok: false,
      reason: `passable share ${(passableShare * 100).toFixed(0)}% is far outside the ${profile} band (${(shareMin * 100).toFixed(0)}-${(shareMax * 100).toFixed(0)}%)`,
    };
  }
  return { ok: true };
}

function assembleFootprintHexes(
  contracted: ContractedGraph,
  passableByArea: AreaCells,
  blockedByOwner: AreaCells,
  linkCells: Map<string, IHexCoordinates[]>,
): EmbeddedHex[] {
  const hexes: EmbeddedHex[] = [];
  for (const node of contracted.areaNodes) {
    for (const key of passableByArea.get(node.id) ?? []) {
      hexes.push({
        coordinates: keyToCoord(key),
        owner: { kind: 'NODE', nodeId: node.id },
        passable: true,
      });
    }
  }
  for (const [ownerId, cells] of blockedByOwner) {
    for (const key of cells) {
      hexes.push({
        coordinates: keyToCoord(key),
        owner: { kind: 'NODE', nodeId: ownerId },
        passable: false,
      });
    }
  }
  for (const link of contracted.links) {
    for (const coordinates of linkCells.get(link.id) ?? []) {
      hexes.push({ coordinates, owner: { kind: 'EDGE', edgeId: link.id }, passable: true });
    }
  }
  return hexes;
}

function appendShell(hexes: EmbeddedHex[], boardColumns: number, boardRows: number): void {
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

  const placedSoFar = new Set([...footprintKeys, ...shellKeys]);
  const reachableFromBorder = new Set<string>();
  const borderQueue: IHexCoordinates[] = [];
  for (let column = 0; column < boardColumns; column += 1) {
    for (const row of [0, boardRows - 1]) {
      const coord = { columnIndex: column, rowIndex: row };
      if (!placedSoFar.has(coordinateKey(coord))) borderQueue.push(coord);
    }
  }
  for (let row = 0; row < boardRows; row += 1) {
    for (const column of [0, boardColumns - 1]) {
      const coord = { columnIndex: column, rowIndex: row };
      if (!placedSoFar.has(coordinateKey(coord))) borderQueue.push(coord);
    }
  }
  while (borderQueue.length) {
    const current = borderQueue.shift() as IHexCoordinates;
    const key = coordinateKey(current);
    if (reachableFromBorder.has(key)) continue;
    reachableFromBorder.add(key);
    for (const neighbor of getHexNeighbors(current)) {
      if (neighbor.columnIndex < 0 || neighbor.columnIndex >= boardColumns) continue;
      if (neighbor.rowIndex < 0 || neighbor.rowIndex >= boardRows) continue;
      const neighborKey = coordinateKey(neighbor);
      if (placedSoFar.has(neighborKey) || reachableFromBorder.has(neighborKey)) continue;
      borderQueue.push(neighbor);
    }
  }
  for (let column = 0; column < boardColumns; column += 1) {
    for (let row = 0; row < boardRows; row += 1) {
      const key = coordinateKey({ columnIndex: column, rowIndex: row });
      if (!placedSoFar.has(key) && !reachableFromBorder.has(key)) shellKeys.add(key);
    }
  }

  for (const key of shellKeys) {
    hexes.push({ coordinates: keyToCoord(key), owner: { kind: 'SHELL' }, passable: false });
  }
}

function buildAnchors(
  contracted: ContractedGraph,
  passableByArea: AreaCells,
): Map<string, IHexCoordinates> {
  const anchorByAreaId = new Map<string, IHexCoordinates>();
  for (const node of contracted.areaNodes) {
    const cells = passableByArea.get(node.id);
    if (cells && cells.size > 0) anchorByAreaId.set(node.id, keyToCoord([...cells][0]));
  }
  return anchorByAreaId;
}

export function embedRegion(input: EmbedRegionInput): EmbedResult {
  const { graph, boardColumns, boardRows, profile, embedSeed } = input;

  const layout = layoutAreaCenters(graph, boardColumns, boardRows, embedSeed);
  if (!layout.ok) return layout;
  const { contracted, centers, orientation } = layout;

  const grownAndCarved = growAndCarveAreas(
    contracted,
    centers,
    profile,
    boardColumns,
    boardRows,
    embedSeed,
  );
  if (!grownAndCarved.ok) return grownAndCarved;
  const { passableByArea, blockedByOwner } = grownAndCarved;

  const compactness = checkAreaCompactness(passableByArea);
  if (!compactness.ok) return compactness;

  const blockedCellKeys = new Set([...blockedByOwner.values()].flatMap((cells) => [...cells]));
  const linksResult = carveLinks(
    contracted.links,
    passableByArea,
    boardColumns,
    boardRows,
    blockedCellKeys,
  );
  if (!linksResult.ok) return linksResult;

  const fillShareCheck = checkFillShare(
    passableByArea,
    linksResult,
    profile,
    boardColumns,
    boardRows,
  );
  if (!fillShareCheck.ok) return fillShareCheck;

  const hexes = assembleFootprintHexes(
    contracted,
    passableByArea,
    blockedByOwner,
    linksResult.linkCells,
  );
  appendShell(hexes, boardColumns, boardRows);

  const anchorByAreaId = buildAnchors(contracted, passableByArea);

  const linkVerification = verifyAreaLinksConnectivity(contracted.links, hexes, anchorByAreaId);
  if (!linkVerification.ok) return linkVerification;

  const forkVerification = verifyForksMeaningfulInHexes(
    graph,
    contracted,
    passableByArea,
    linksResult.linkCells,
  );
  if (!forkVerification.ok) return forkVerification;

  const portals = contracted.areaNodes
    .filter((node) => node.role === 'PORTAL')
    .map((node) => {
      const anchor = anchorByAreaId.get(node.id);
      return anchor ? { nodeId: node.id, coordinates: anchor } : null;
    })
    .filter(
      (portal): portal is { nodeId: string; coordinates: IHexCoordinates } => portal !== null,
    );

  return {
    ok: true,
    board: { boardColumns, boardRows, hexes, portals, entrySide: orientation.entrySide },
  };
}

export const MAX_EMBED_ATTEMPTS = 60;

export function embedRegionWithRetry(
  input: Omit<EmbedRegionInput, 'embedSeed'> & { embedSeedRoot: string },
): EmbedResult {
  const { embedSeedRoot, ...rest } = input;
  let lastResult: EmbedResult = { ok: false, reason: 'no attempt was made' };

  for (let attempt = 0; attempt < MAX_EMBED_ATTEMPTS; attempt += 1) {
    lastResult = embedRegion({ ...rest, embedSeed: `${embedSeedRoot}:${attempt}` });
    if (lastResult.ok) return lastResult;
  }

  return lastResult;
}
