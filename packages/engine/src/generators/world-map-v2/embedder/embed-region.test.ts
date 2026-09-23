import { describe, expect, it } from 'vitest';
import { coordinateKey, getHexNeighbors } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { BOARD_COLUMNS, BOARD_ROWS } from '../board-size';
import { generateRegionGraph } from '../generate-region-graph';
import type { EmbeddedBoard } from '../embedded-board';
import { embedRegion } from './embed-region';

/** Flood-fills every board cell NOT in the board from the outer border inward — if any non-board cell is unreachable, it's an enclosed pocket the shell failed to cover. */
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

function assertBoardInvariants(board: EmbeddedBoard) {
  expect(board.boardColumns).toBe(BOARD_COLUMNS);
  expect(board.boardRows).toBe(BOARD_ROWS);

  const keys = board.hexes.map((hex) => coordinateKey(hex.coordinates));
  expect(new Set(keys).size).toBe(keys.length); // no coordinate used twice

  for (const hex of board.hexes) {
    expect(hex.coordinates.columnIndex).toBeGreaterThanOrEqual(0);
    expect(hex.coordinates.columnIndex).toBeLessThan(board.boardColumns);
    expect(hex.coordinates.rowIndex).toBeGreaterThanOrEqual(0);
    expect(hex.coordinates.rowIndex).toBeLessThan(board.boardRows);

    if (hex.passable) expect(hex.owner.kind).not.toBe('SHELL');
    if (hex.owner.kind === 'SHELL') expect(hex.passable).toBe(false);
  }

  expect(hasEnclosedPocket(board)).toBe(false);
  expect(board.portals.length).toBeGreaterThan(0);
}

describe('embedRegion + generateRegionGraph (integration, 200 seeds)', () => {
  it('embeds successfully in the overwhelming majority of seeds, and every success satisfies every hard invariant', () => {
    let successes = 0;
    let failures = 0;

    for (let i = 0; i < 200; i += 1) {
      const generated = generateRegionGraph({
        boardSeed: `board-${i}`,
        profile: i % 2 === 0 ? 'WORLD' : 'DUNGEON',
        recentGrammarIds: [],
      });

      const result = embedRegion({
        graph: generated.proposition.graph,
        boardColumns: BOARD_COLUMNS,
        boardRows: BOARD_ROWS,
      });

      if (result.ok) {
        successes += 1;
        assertBoardInvariants(result.board);
      } else {
        failures += 1;
      }
    }

    // The three grammars are small relative to an 18x17 board, so a
    // rejection should be rare (a genuine local-layout collision or an
    // actual board-fit failure), not the common case.
    expect(successes).toBeGreaterThan(190);
    expect(successes + failures).toBe(200);
  });

  it('same seed gives the same embedding', () => {
    const generated = generateRegionGraph({
      boardSeed: 'board-determinism',
      profile: 'WORLD',
      recentGrammarIds: [],
    });

    const a = embedRegion({
      graph: generated.proposition.graph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
    });
    const b = embedRegion({
      graph: generated.proposition.graph,
      boardColumns: BOARD_COLUMNS,
      boardRows: BOARD_ROWS,
    });

    expect(a).toEqual(b);
  });

  it('every passable hex belongs to a node or an edge, never unexplained', () => {
    for (let i = 0; i < 30; i += 1) {
      const generated = generateRegionGraph({
        boardSeed: `owner-check-${i}`,
        profile: 'WORLD',
        recentGrammarIds: [],
      });
      const result = embedRegion({
        graph: generated.proposition.graph,
        boardColumns: BOARD_COLUMNS,
        boardRows: BOARD_ROWS,
      });
      if (!result.ok) continue;

      for (const hex of result.board.hexes) {
        if (hex.passable) {
          expect(['NODE', 'EDGE']).toContain(hex.owner.kind);
        }
      }
    }
  });

  it('rejects a graph that cannot possibly fit the board, rather than resizing it', () => {
    const oversizedGraph = {
      nodes: [
        { id: 'entry', role: 'ENTRY' as const },
        ...Array.from({ length: BOARD_COLUMNS * BOARD_ROWS }, (_, i) => ({
          id: `chain-${i}`,
          role: 'TRANSIT' as const,
        })),
        { id: 'portal', role: 'PORTAL' as const },
      ],
      edges: [] as {
        id: string;
        from: string;
        to: string;
        traversal: 'OPEN';
        semanticRole: 'MAIN';
        weight: number;
      }[],
    };
    let previous = 'entry';
    for (let i = 0; i < BOARD_COLUMNS * BOARD_ROWS; i += 1) {
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
    });

    expect(result.ok).toBe(false);
  });
});
