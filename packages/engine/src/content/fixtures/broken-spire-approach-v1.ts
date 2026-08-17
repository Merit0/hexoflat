import { parseWorldFixture, type WorldFixture } from './world-fixture-schema';

/**
 * `BROKEN_SPIRE_APPROACH_V1` — the deterministic vertical-slice world.
 *
 * Coordinates are the repo's own **odd-q offset, flat-top** `{columnIndex,
 * rowIndex}`, taken from the conversion table in
 * `docs/EXPLORATION-SLICE-WORKFLOW.md` §3.1. The design document authors the
 * same world in pointy-top axial `{q, r}`; the two describe an identical
 * topology, and `broken-spire-approach-v1.adjacency.test.ts` proves it by
 * running the document's table through
 *
 *   col = q + 2;  row = r + (col - (col & 1)) / 2
 *
 * and checking that every axial-adjacent pair is still adjacent under
 * `getOddQNeighbors`. That test is the guard against a silent column-parity
 * shift the next time anyone edits a row here — the failure mode it catches
 * is a fixture that still looks right in a table and is wrong on the board.
 *
 * The `+2` column offset exists because the base grid starts at `(0,0)` and
 * holds no negative coordinates, while the document's world has hexes at
 * negative `q`.
 */

export const FIXTURE_ID = 'BROKEN_SPIRE_APPROACH_V1';
export const VERTICAL_SLICE_WORLD_SEED = 'HF-EXPLORATION-VS-001';
export const GENERATION_VERSION = 'exploration-vs-0.1';

/**
 * 14 × 9 rather than the minimum 11 × 6 the authored hexes need. The surplus
 * is never drawn — it stays `UNKNOWN`, and `UNKNOWN` has no sprite and is not
 * part of the board's bounds — but it means the frontier can grow in any
 * direction without running into the edge of the array (workflow §3.1).
 */
export const FIXTURE_GRID = { width: 14, height: 9 } as const;

/** Where the hero appears on `ExitCampToWorld` (design §8.1). */
export const WORLD_ENTRY = { columnIndex: 3, rowIndex: 1 } as const;

export const BROKEN_SPIRE_APPROACH_V1: WorldFixture = parseWorldFixture({
  fixtureId: FIXTURE_ID,
  worldSeed: VERTICAL_SLICE_WORLD_SEED,
  generationVersion: GENERATION_VERSION,
  grid: FIXTURE_GRID,
  worldEntry: WORLD_ENTRY,
  hexes: [
    // ---- CAMP_RING: the island of known world the player starts inside ----
    {
      id: 'camp_world_anchor',
      coordinates: { columnIndex: 2, rowIndex: 1 },
      region: 'CAMP_RING',
      terrain: 'CAMP',
      traversal: 'OPEN',
      initialDiscovery: 'UNDERSTOOD',
      role: 'Camp Anchor',
    },
    {
      id: 'world_exit_spawn',
      coordinates: { columnIndex: 3, rowIndex: 1 },
      region: 'CAMP_RING',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'DISCOVERED',
      role: 'Hero appears here after leaving Camp',
    },
    {
      // The three-cut mark is visible from the first second and means nothing
      // until Insight in E6. In E1 it is a drawing on a rock, deliberately.
      id: 'old_marked_ridge',
      coordinates: { columnIndex: 3, rowIndex: 0 },
      region: 'CAMP_RING',
      terrain: 'STONE_MASS',
      traversal: 'BLOCKED',
      initialDiscovery: 'DISCOVERED',
      role: 'Old unfamiliar three-cut mark; later Memory Spark',
    },
    {
      id: 'camp_nw',
      coordinates: { columnIndex: 2, rowIndex: 0 },
      region: 'CAMP_RING',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'DISCOVERED',
      role: 'initial ring',
    },
    {
      id: 'camp_w',
      coordinates: { columnIndex: 1, rowIndex: 0 },
      region: 'CAMP_RING',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'DISCOVERED',
      role: 'initial ring',
    },
    {
      id: 'camp_sw',
      coordinates: { columnIndex: 1, rowIndex: 1 },
      region: 'CAMP_RING',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'DISCOVERED',
      role: 'initial ring',
    },
    {
      id: 'camp_se',
      coordinates: { columnIndex: 2, rowIndex: 2 },
      region: 'CAMP_RING',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'DISCOVERED',
      role: 'initial ring',
    },
    {
      // OBSERVED, not DISCOVERED: this is the hex that makes the starting
      // shape read as an island with a soft edge instead of a ring with a
      // wall around it.
      id: 'camp_e_south',
      coordinates: { columnIndex: 3, rowIndex: 2 },
      region: 'CAMP_RING',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'OBSERVED',
      role: 'organic edge cue',
    },

    // ---- REGION_A — forked ridge: route / tool / timing proposition ----
    {
      id: 'ridge_junction',
      coordinates: { columnIndex: 4, rowIndex: 2 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'OBSERVED',
      role: 'fork decision — the eastward continuation, visible on world entry',
    },
    {
      id: 'north_approach_1',
      coordinates: { columnIndex: 4, rowIndex: 1 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'long/sheltered route',
    },
    {
      id: 'ruin_shelter',
      coordinates: { columnIndex: 5, rowIndex: 1 },
      region: 'REGION_A',
      terrain: 'RUIN',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Shelter Anchor candidate',
    },
    {
      id: 'medicinal_habitat',
      coordinates: { columnIndex: 5, rowIndex: 0 },
      region: 'REGION_A',
      terrain: 'VEGETATION',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Medicinal Plant source',
    },
    {
      id: 'north_approach_2',
      coordinates: { columnIndex: 6, rowIndex: 2 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'long route',
    },
    {
      // Starts UNKNOWN and needs no authored rule to become the barrier the
      // player sees from the fork: it is a neighbour of `ridge_junction`, so
      // the step rule observes it the moment the hero stands there.
      id: 'stone_crust_shortcut',
      coordinates: { columnIndex: 5, rowIndex: 2 },
      region: 'REGION_A',
      terrain: 'STONE_CRUST',
      traversal: 'DESTRUCTIBLE',
      initialDiscovery: 'UNKNOWN',
      role: 'Pickaxe shortcut — impassable until E3 breaks it',
    },
    {
      id: 'route_merge',
      coordinates: { columnIndex: 6, rowIndex: 3 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'merge / route thread junction',
    },
    {
      id: 'frontier_gate_a_b',
      coordinates: { columnIndex: 7, rowIndex: 3 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'transition to Region B',
    },
    {
      id: 'patrol_investigation_lane',
      coordinates: { columnIndex: 5, rowIndex: 3 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'not a main Hero route',
    },
    {
      id: 'patrol_p3',
      coordinates: { columnIndex: 6, rowIndex: 4 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Patrol path',
    },
    {
      id: 'patrol_p0',
      coordinates: { columnIndex: 6, rowIndex: 5 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Patrol initial position',
    },
    {
      id: 'patrol_p1',
      coordinates: { columnIndex: 7, rowIndex: 5 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Patrol path',
    },
    {
      id: 'patrol_p2',
      coordinates: { columnIndex: 7, rowIndex: 4 },
      region: 'REGION_A',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Patrol path / potential route threat',
    },

    // ---- REGION_B — Broken Spire: landmark / knowledge proposition ----
    {
      id: 'spire_approach',
      coordinates: { columnIndex: 8, rowIndex: 4 },
      region: 'REGION_B',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Landmark approach',
    },
    {
      id: 'trace_marked_seam',
      coordinates: { columnIndex: 8, rowIndex: 3 },
      region: 'REGION_B',
      terrain: 'RUIN',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Primary Trace A',
    },
    {
      id: 'trace_broken_pickaxe',
      coordinates: { columnIndex: 9, rowIndex: 3 },
      region: 'REGION_B',
      terrain: 'RUIN',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Primary Trace B',
    },
    {
      // The Spire's hex is BLOCKED and stays UNKNOWN. What the player gets
      // from Camp is `distantObservation` and nothing else — no discovery
      // state, no map highlight, no hex count. See design §17.
      id: 'broken_spire',
      coordinates: { columnIndex: 9, rowIndex: 4 },
      region: 'REGION_B',
      terrain: 'RUIN',
      traversal: 'BLOCKED',
      initialDiscovery: 'UNKNOWN',
      role: 'Regional Landmark — blocked as an occupant/structure',
      distantObservation: {
        silhouetteKey: 'exploration.landmark.broken-spire.silhouette',
        bearingFrom: [
          { from: { columnIndex: 3, rowIndex: 1 }, bearing: 'SE' },
          { from: { columnIndex: 4, rowIndex: 2 }, bearing: 'SE' },
        ],
      },
    },
    {
      id: 'trace_rope_anchor',
      coordinates: { columnIndex: 10, rowIndex: 4 },
      region: 'REGION_B',
      terrain: 'RUIN',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'Optional Trace',
    },
    {
      id: 'frontier_exit',
      coordinates: { columnIndex: 10, rowIndex: 5 },
      region: 'REGION_B',
      terrain: 'GROUND',
      traversal: 'OPEN',
      initialDiscovery: 'UNKNOWN',
      role: 'next-world Promise — tease only, no generated Region C',
    },
  ],
});

/** Exactly the 27 hexes of §3.1's table — the linter asserts this, it is not a comment. */
export const AUTHORED_HEX_COUNT = 27;
