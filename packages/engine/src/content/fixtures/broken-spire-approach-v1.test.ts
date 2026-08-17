import { describe, expect, it } from 'vitest';
import { coordinateKey, getOddQNeighbors } from '../../utils/hex-utils';
import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import {
  AUTHORED_HEX_COUNT,
  BROKEN_SPIRE_APPROACH_V1,
  FIXTURE_GRID,
  FIXTURE_ID,
  GENERATION_VERSION,
  VERTICAL_SLICE_WORLD_SEED,
  WORLD_ENTRY,
} from './broken-spire-approach-v1';

/**
 * The design document authors this world in pointy-top axial `{q, r}`; the
 * repo renders odd-q offset flat-top `{columnIndex, rowIndex}`. Workflow §3.1
 * resolves that with a fixed shift, and this file is the proof that the shift
 * was applied correctly — not once, but on every future edit.
 *
 * The bug it is written against is specific and silent: odd-q's row offset
 * depends on column *parity*, so mistyping one column shifts that hex half a
 * row and quietly rewires which hexes are neighbours. The map still looks
 * plausible in a table and is wrong on the board. Nothing else in the repo
 * would notice.
 */

const AXIAL_TABLE: Array<{ id: string; q: number; r: number }> = [
  { id: 'camp_world_anchor', q: 0, r: 0 },
  { id: 'world_exit_spawn', q: 1, r: 0 },
  { id: 'old_marked_ridge', q: 1, r: -1 },
  { id: 'camp_nw', q: 0, r: -1 },
  { id: 'camp_w', q: -1, r: 0 },
  { id: 'camp_sw', q: -1, r: 1 },
  { id: 'camp_se', q: 0, r: 1 },
  { id: 'camp_e_south', q: 1, r: 1 },
  { id: 'ridge_junction', q: 2, r: 0 },
  { id: 'north_approach_1', q: 2, r: -1 },
  { id: 'ruin_shelter', q: 3, r: -1 },
  { id: 'medicinal_habitat', q: 3, r: -2 },
  { id: 'north_approach_2', q: 4, r: -1 },
  { id: 'stone_crust_shortcut', q: 3, r: 0 },
  { id: 'route_merge', q: 4, r: 0 },
  { id: 'frontier_gate_a_b', q: 5, r: 0 },
  { id: 'patrol_investigation_lane', q: 3, r: 1 },
  { id: 'patrol_p3', q: 4, r: 1 },
  { id: 'patrol_p0', q: 4, r: 2 },
  { id: 'patrol_p1', q: 5, r: 2 },
  { id: 'patrol_p2', q: 5, r: 1 },
  { id: 'spire_approach', q: 6, r: 0 },
  { id: 'trace_marked_seam', q: 6, r: -1 },
  { id: 'trace_broken_pickaxe', q: 7, r: -1 },
  { id: 'broken_spire', q: 7, r: 0 },
  { id: 'trace_rope_anchor', q: 8, r: -1 },
  { id: 'frontier_exit', q: 8, r: 0 },
];

/** Workflow §3.1's conversion, verbatim. */
const DQ = 2;
const DR = 0;
function axialToFixtureOddQ(q: number, r: number): IHexCoordinates {
  const columnIndex = q + DQ;
  const rowIndex = r + DR + (columnIndex - (columnIndex & 1)) / 2;
  return { columnIndex, rowIndex };
}

/** The document's own pointy-top axial neighbour convention (design §5). */
const AXIAL_DIRS = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
];

function areAxialNeighbors(a: { q: number; r: number }, b: { q: number; r: number }): boolean {
  return AXIAL_DIRS.some((dir) => a.q + dir.q === b.q && a.r + dir.r === b.r);
}

describe('BROKEN_SPIRE_APPROACH_V1 metadata', () => {
  it('carries the frozen generation metadata', () => {
    expect(FIXTURE_ID).toBe('BROKEN_SPIRE_APPROACH_V1');
    expect(VERTICAL_SLICE_WORLD_SEED).toBe('HF-EXPLORATION-VS-001');
    expect(GENERATION_VERSION).toBe('exploration-vs-0.1');
    expect(BROKEN_SPIRE_APPROACH_V1.fixtureId).toBe(FIXTURE_ID);
  });

  it('authors exactly 27 hexes on a 14x9 technical grid', () => {
    expect(BROKEN_SPIRE_APPROACH_V1.hexes).toHaveLength(AUTHORED_HEX_COUNT);
    expect(FIXTURE_GRID).toEqual({ width: 14, height: 9 });

    // The surplus is the point: the authored shape has to fit with room left
    // over, or the frontier grows into the edge of the array.
    const maxColumn = Math.max(
      ...BROKEN_SPIRE_APPROACH_V1.hexes.map((hex) => hex.coordinates.columnIndex),
    );
    const maxRow = Math.max(
      ...BROKEN_SPIRE_APPROACH_V1.hexes.map((hex) => hex.coordinates.rowIndex),
    );
    expect(maxColumn).toBeLessThan(FIXTURE_GRID.width);
    expect(maxRow).toBeLessThan(FIXTURE_GRID.height);
  });

  it('spawns the hero on an authored hex', () => {
    expect(WORLD_ENTRY).toEqual({ columnIndex: 3, rowIndex: 1 });
    expect(
      BROKEN_SPIRE_APPROACH_V1.hexes.some(
        (hex) => coordinateKey(hex.coordinates) === coordinateKey(WORLD_ENTRY),
      ),
    ).toBe(true);
  });
});

describe('axial -> odd-q conversion', () => {
  it('places every hex where the workflow table says', () => {
    const byId = new Map(BROKEN_SPIRE_APPROACH_V1.hexes.map((hex) => [hex.id, hex]));

    for (const row of AXIAL_TABLE) {
      const hex = byId.get(row.id);
      expect(hex, `fixture has no hex '${row.id}'`).toBeDefined();
      expect(hex?.coordinates, `'${row.id}' is at the wrong coordinate`).toEqual(
        axialToFixtureOddQ(row.q, row.r),
      );
    }
  });

  it('covers the document table exactly — no extra hexes, none missing', () => {
    expect(new Set(BROKEN_SPIRE_APPROACH_V1.hexes.map((hex) => hex.id))).toEqual(
      new Set(AXIAL_TABLE.map((row) => row.id)),
    );
  });

  it('preserves adjacency for every pair in the fixture', () => {
    // The real assertion of this file: for all 27x27 ordered pairs, being
    // neighbours in the document's axial space and being neighbours under
    // `getOddQNeighbors` must be the same statement. Checking only the pairs
    // that *are* adjacent would miss a parity slip that invents an adjacency
    // rather than losing one, so both directions are checked together.
    let comparedPairs = 0;
    let adjacentPairs = 0;

    for (const a of AXIAL_TABLE) {
      const oddQNeighbors = new Set(
        getOddQNeighbors(axialToFixtureOddQ(a.q, a.r)).map(coordinateKey),
      );

      for (const b of AXIAL_TABLE) {
        if (a.id === b.id) continue;
        comparedPairs += 1;

        const axialAdjacent = areAxialNeighbors(a, b);
        const oddQAdjacent = oddQNeighbors.has(coordinateKey(axialToFixtureOddQ(b.q, b.r)));

        expect(
          oddQAdjacent,
          `'${a.id}' and '${b.id}': axial says ${axialAdjacent}, odd-q says ${oddQAdjacent}`,
        ).toBe(axialAdjacent);

        if (axialAdjacent) adjacentPairs += 1;
      }
    }

    expect(comparedPairs).toBe(AXIAL_TABLE.length * (AXIAL_TABLE.length - 1));
    // Guards the guard: if the conversion ever collapsed the world into
    // disconnected points, every pair would agree on "not adjacent" and the
    // loop above would pass while proving nothing.
    expect(adjacentPairs).toBeGreaterThan(0);
  });
});
