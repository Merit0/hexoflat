import { describe, expect, it } from 'vitest';
import { coordinateKey, getHexNeighbors, hexDistance } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { BOARD_COLUMNS, BOARD_ROWS } from '../board-size';
import { generateRegionGraph } from '../generate-region-graph';
import type { EmbeddedBoard } from '../embedded-board';
import type { RegionTopologyGraph } from '../region-topology';
import { embedRegion, embedRegionWithRetry } from './embed-region';
import { MIN_AREA_HEXES } from './area-weights';
import { keyToCoord } from './hex-key-utils';

const TOTAL_CELLS = BOARD_COLUMNS * BOARD_ROWS;

function hasEnclosedPocket(board: EmbeddedBoard): boolean {
  const placed = new Set(board.hexes.map((hex) => coordinateKey(hex.coordinates)));
  const outside = new Set<string>();
  const queue: IHexCoordinates[] = [];

  for (let col = 0; col < board.boardColumns; col += 1) {
    for (const row of [0, board.boardRows - 1]) {
      const coord = { columnIndex: col, rowIndex: row };
      if (!placed.has(coordinateKey(coord))) queue.push(coord);
    }
  }
  for (let row = 0; row < board.boardRows; row += 1) {
    for (const col of [0, board.boardColumns - 1]) {
      const coord = { columnIndex: col, rowIndex: row };
      if (!placed.has(coordinateKey(coord))) queue.push(coord);
    }
  }

  while (queue.length) {
    const current = queue.shift() as IHexCoordinates;
    const key = coordinateKey(current);
    if (outside.has(key)) continue;
    outside.add(key);
    for (const neighbor of getHexNeighbors(current)) {
      if (neighbor.columnIndex < 0 || neighbor.columnIndex >= board.boardColumns) continue;
      if (neighbor.rowIndex < 0 || neighbor.rowIndex >= board.boardRows) continue;
      const neighborKey = coordinateKey(neighbor);
      if (placed.has(neighborKey) || outside.has(neighborKey)) continue;
      queue.push(neighbor);
    }
  }

  let totalNonPlaced = 0;
  for (let col = 0; col < board.boardColumns; col += 1) {
    for (let row = 0; row < board.boardRows; row += 1) {
      if (!placed.has(coordinateKey({ columnIndex: col, rowIndex: row }))) totalNonPlaced += 1;
    }
  }
  return outside.size < totalNonPlaced;
}

function areaCells(board: EmbeddedBoard): Map<string, IHexCoordinates[]> {
  const byNode = new Map<string, IHexCoordinates[]>();
  for (const hex of board.hexes) {
    if (hex.owner.kind !== 'NODE') continue;
    byNode.set(hex.owner.nodeId, [...(byNode.get(hex.owner.nodeId) ?? []), hex.coordinates]);
  }
  return byNode;
}

function linkSizes(board: EmbeddedBoard): Map<string, number> {
  const byEdge = new Map<string, number>();
  for (const hex of board.hexes) {
    if (hex.owner.kind !== 'EDGE') continue;
    byEdge.set(hex.owner.edgeId, (byEdge.get(hex.owner.edgeId) ?? 0) + 1);
  }
  return byEdge;
}

function maxInternalDistance(cells: IHexCoordinates[]): number {
  let max = 0;
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      max = Math.max(max, hexDistance(cells[i], cells[j]));
    }
  }
  return max;
}

function boardHash(board: EmbeddedBoard): string {
  return board.hexes
    .map((hex) => `${coordinateKey(hex.coordinates)}:${hex.owner.kind}:${hex.passable ? 1 : 0}`)
    .sort()
    .join('|');
}

function assertHardInvariants(board: EmbeddedBoard, graph: RegionTopologyGraph) {
  const allowedTouchPairs = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.traversal !== 'BLOCKED') continue;
    allowedTouchPairs.add(`${edge.from}:${edge.to}`);
    allowedTouchPairs.add(`${edge.to}:${edge.from}`);
  }

  expect(board.boardColumns).toBe(BOARD_COLUMNS);
  expect(board.boardRows).toBe(BOARD_ROWS);

  const keys = board.hexes.map((hex) => coordinateKey(hex.coordinates));
  expect(new Set(keys).size).toBe(keys.length);

  for (const hex of board.hexes) {
    expect(hex.coordinates.columnIndex).toBeGreaterThanOrEqual(0);
    expect(hex.coordinates.columnIndex).toBeLessThan(board.boardColumns);
    expect(hex.coordinates.rowIndex).toBeGreaterThanOrEqual(0);
    expect(hex.coordinates.rowIndex).toBeLessThan(board.boardRows);
    if (hex.passable) expect(hex.owner.kind).not.toBe('SHELL');
  }

  expect(hasEnclosedPocket(board)).toBe(false);
  expect(board.portals.length).toBeGreaterThan(0);

  const nodeOwnerByKey = new Map<string, string>();
  for (const hex of board.hexes) {
    if (hex.owner.kind === 'NODE')
      nodeOwnerByKey.set(coordinateKey(hex.coordinates), hex.owner.nodeId);
  }
  for (const [key, nodeId] of nodeOwnerByKey) {
    for (const neighbor of getHexNeighbors(keyToCoord(key))) {
      const neighborOwner = nodeOwnerByKey.get(coordinateKey(neighbor));
      if (!neighborOwner || neighborOwner === nodeId) continue;
      if (allowedTouchPairs.has(`${nodeId}:${neighborOwner}`)) continue;
      expect(neighborOwner).toBe(nodeId);
    }
  }

  const obstructionNodeIds = new Set(
    graph.nodes.filter((node) => node.role === 'OBSTRUCTION').map((node) => node.id),
  );

  for (const [nodeId, cells] of areaCells(board)) {
    if (obstructionNodeIds.has(nodeId)) continue;
    expect(cells.length).toBeGreaterThanOrEqual(MIN_AREA_HEXES - 1);
    if (cells.length > 1) {
      expect(maxInternalDistance(cells)).toBeLessThanOrEqual(1.5 * Math.sqrt(cells.length) + 2);
    }
    void nodeId;
  }

  for (const size of linkSizes(board).values()) {
    expect(size).toBeGreaterThanOrEqual(1);
    expect(size).toBeLessThanOrEqual(4);
  }
}

describe('embedRegion (G2b area-based embedder) — invariants', () => {
  it('embeds successfully in the large majority of seeds, and every success satisfies the hard invariants', () => {
    let successes = 0;
    const hashes = new Set<string>();
    const entrySides = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      const profile = i % 2 === 0 ? 'WORLD' : 'DUNGEON';
      const generated = generateRegionGraph({
        boardSeed: `board-${i}`,
        profile,
        recentGrammarIds: [],
      });
      const result = embedRegionWithRetry({
        graph: generated.proposition.graph,
        boardColumns: BOARD_COLUMNS,
        boardRows: BOARD_ROWS,
        profile,
        embedSeedRoot: `embed-${i}`,
      });

      if (!result.ok) continue;
      successes += 1;
      assertHardInvariants(result.board, generated.proposition.graph);
      hashes.add(boardHash(result.board));
      entrySides.add(result.board.entrySide);
    }

    expect(successes).toBeGreaterThan(120);
    expect(hashes.size).toBeGreaterThanOrEqual(100);
    expect(entrySides.size).toBe(4);
  }, 20000);

  it('passable share falls within the profile band (D17), with floor/rounding slack', () => {
    for (let i = 0; i < 60; i += 1) {
      const profile = i % 2 === 0 ? 'WORLD' : 'DUNGEON';
      const generated = generateRegionGraph({
        boardSeed: `share-${i}`,
        profile,
        recentGrammarIds: [],
      });
      const result = embedRegionWithRetry({
        graph: generated.proposition.graph,
        boardColumns: BOARD_COLUMNS,
        boardRows: BOARD_ROWS,
        profile,
        embedSeedRoot: `embed-share-${i}`,
      });
      if (!result.ok) continue;

      const passableShare = result.board.hexes.filter((hex) => hex.passable).length / TOTAL_CELLS;
      if (profile === 'WORLD') {
        expect(passableShare).toBeGreaterThan(0.4);
        expect(passableShare).toBeLessThan(0.75);
      } else {
        expect(passableShare).toBeGreaterThan(0.25);
        expect(passableShare).toBeLessThan(0.6);
      }
    }
  });
});

describe('embedRegion (G2b area-based embedder) — determinism and edge cases', () => {
  it('the same graph embeds visibly differently under WORLD vs DUNGEON', () => {
    const generated = generateRegionGraph({
      boardSeed: 'shared-graph',
      profile: 'WORLD',
      recentGrammarIds: [],
    });

    const world = embedRegionWithRetry({
      graph: generated.proposition.graph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
      profile: 'WORLD',
      embedSeedRoot: 'shared-embed-world',
    });
    const dungeon = embedRegionWithRetry({
      graph: generated.proposition.graph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
      profile: 'DUNGEON',
      embedSeedRoot: 'shared-embed-dungeon',
    });

    expect(world.ok && dungeon.ok).toBe(true);
    if (world.ok && dungeon.ok) {
      const worldPassable = world.board.hexes.filter((h) => h.passable).length;
      const dungeonPassable = dungeon.board.hexes.filter((h) => h.passable).length;
      expect(worldPassable).not.toBe(dungeonPassable);
    }
  });

  it('same seed gives the same embedding', () => {
    const generated = generateRegionGraph({
      boardSeed: 'determinism',
      profile: 'WORLD',
      recentGrammarIds: [],
    });
    const input = {
      graph: generated.proposition.graph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
      profile: 'WORLD' as const,
      embedSeed: 'determinism-embed',
    };

    expect(embedRegion(input)).toEqual(embedRegion(input));
  });

  it('rejects a graph that cannot possibly fit the board, rather than resizing it', () => {
    const oversizedGraph: RegionTopologyGraph = {
      nodes: [
        { id: 'entry', role: 'ENTRY' },
        ...Array.from({ length: 40 }, (_, i) => ({ id: `chain-${i}`, role: 'TRANSIT' as const })),
        { id: 'portal', role: 'PORTAL' },
      ],
      edges: [],
    };
    let previous = 'entry';
    for (let i = 0; i < 40; i += 1) {
      oversizedGraph.edges.push({
        id: `e-${i}`,
        from: previous,
        to: `chain-${i}`,
        traversal: 'OPEN',
        semanticRole: 'MAIN',
        weight: 1,
      });
      previous = `chain-${i}`;
    }
    oversizedGraph.edges.push({
      id: 'e-final',
      from: previous,
      to: 'portal',
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    });

    const result = embedRegion({
      graph: oversizedGraph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
      profile: 'WORLD',
      embedSeed: 'oversized',
    });

    expect(result.ok).toBe(false);
  });

  it('embedRegionWithRetry is deterministic for the same seed root', () => {
    const generated = generateRegionGraph({
      boardSeed: 'retry-determinism',
      profile: 'WORLD',
      recentGrammarIds: [],
    });
    const input = {
      graph: generated.proposition.graph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
      profile: 'WORLD' as const,
      embedSeedRoot: 'retry-determinism-embed',
    };

    expect(embedRegionWithRetry(input)).toEqual(embedRegionWithRetry(input));
  });
});
