import { z } from 'zod';
import { DISCOVERY_STATES } from '../../map/discovery-state';

/**
 * Zod schema for authored world fixtures.
 *
 * A fixture is content, so architecture rule #3 applies in full: validated,
 * versioned, and kept away from runtime game state. Nothing here is a
 * `HexTileModel` — `buildFixtureMap` turns this data into one, and the data
 * itself stays a plain, comparable, serialisable description of a world.
 */

/**
 * What a hex *is made of*. Deliberately a separate axis from traversal: the
 * whole point of Stone Crust in E3 is that breaking it changes whether you
 * can walk through it without changing what it is. Collapsing the two into
 * one enum would make that transformation unrepresentable.
 */
export const FIXTURE_TERRAINS = [
  'GROUND',
  'CAMP',
  'STONE_MASS',
  'STONE_CRUST',
  'RUIN',
  'VEGETATION',
] as const;
export type FixtureTerrain = (typeof FIXTURE_TERRAINS)[number];

/**
 * Whether a hex can be walked into *right now*.
 *
 * In E1 `DESTRUCTIBLE` behaves exactly like `BLOCKED` — this phase only
 * declares the state, the transformation that makes the difference matter is
 * E3. Authoring it now (rather than writing `BLOCKED` and editing the fixture
 * later) is what keeps E3 from being a fixture rewrite.
 */
export const TRAVERSALS = ['OPEN', 'BLOCKED', 'DESTRUCTIBLE'] as const;
export type Traversal = (typeof TRAVERSALS)[number];

/** Semantic regions of the slice fixture (design v0.1 §6.2). */
export const FIXTURE_REGIONS = ['CAMP_RING', 'REGION_A', 'REGION_B'] as const;
export type FixtureRegion = (typeof FIXTURE_REGIONS)[number];

/**
 * Compass names for the repo's odd-q **flat-top** tiling. The design document
 * is written pointy-top, so its bearing names are these rotated 30° — the
 * topology is identical (workflow §3.1), only the words for the directions
 * differ. These are the ones a player looking at this game's board would use.
 */
export const BEARINGS = ['N', 'NE', 'SE', 'S', 'SW', 'NW'] as const;
export type Bearing = (typeof BEARINGS)[number];

const coordinatesSchema = z.object({
  columnIndex: z.number().int().nonnegative(),
  rowIndex: z.number().int().nonnegative(),
});

/**
 * A landmark seen from far away: a shape on the horizon and a direction, and
 * deliberately nothing else.
 *
 * This is why the Broken Spire can be a promise from the moment the hero
 * leaves Camp without its hex being anything but `UNKNOWN`. Design §17 draws
 * the line precisely: "a broken vertical silhouette beyond the ridge" is
 * allowed, "Broken Spire — 11 hexes — Quest Objective" is not. So there is no
 * field here for a coordinate, a distance or a name — not as an omission, but
 * so that no consumer can render one.
 */
const distantObservationSchema = z.object({
  /** i18n key for the silhouette line; apps/web resolves it, the engine never reads it. */
  silhouetteKey: z.string().min(1),
  /** Which hexes the silhouette is visible from, and which way it lies from each. */
  bearingFrom: z.array(z.object({ from: coordinatesSchema, bearing: z.enum(BEARINGS) })).min(1),
});
export type DistantObservation = z.infer<typeof distantObservationSchema>;

export const fixtureHexSchema = z.object({
  id: z.string().min(1),
  coordinates: coordinatesSchema,
  region: z.enum(FIXTURE_REGIONS),
  terrain: z.enum(FIXTURE_TERRAINS),
  traversal: z.enum(TRAVERSALS),
  /**
   * What the player knows about this hex the moment they step into the world.
   * Everything the fixture does not author is `UNKNOWN` by construction —
   * the technical grid is not listed hex by hex.
   */
  initialDiscovery: z.enum(DISCOVERY_STATES),
  /** Authoring note, not player-facing text. Never rendered. */
  role: z.string().optional(),
  distantObservation: distantObservationSchema.optional(),
});
export type FixtureHex = z.infer<typeof fixtureHexSchema>;

export const worldFixtureSchema = z.object({
  fixtureId: z.string().min(1),
  /** Fixed so the first playtest never rerolls the geography (design §6.1). */
  worldSeed: z.string().min(1),
  generationVersion: z.string().min(1),
  /**
   * The technical grid. Larger than the authored shape on purpose: the surplus
   * never renders because it stays `UNKNOWN`, and it gives the organic frontier
   * room to grow without hitting the edge of the array (workflow §3.1).
   */
  grid: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  /** Where the hero stands after leaving Camp. Must be an authored hex. */
  worldEntry: coordinatesSchema,
  hexes: z.array(fixtureHexSchema).min(1),
});
export type WorldFixture = z.infer<typeof worldFixtureSchema>;

/** Parses and throws on anything malformed — fixtures are validated at load, not trusted. */
export function parseWorldFixture(raw: unknown): WorldFixture {
  return worldFixtureSchema.parse(raw);
}
