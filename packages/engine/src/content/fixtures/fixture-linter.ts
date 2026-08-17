import { coordinateKey, getOddQNeighbors } from '../../utils/hex-utils';
import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import { indexFixtureHexes } from './build-fixture-map';
import type { FixtureHex, WorldFixture } from './world-fixture-schema';

/**
 * Hard errors from design v0.1 §42, plus the structural checks that make the
 * odd-q encoding trustworthy.
 *
 * §42 lists twenty. Not all of them are decidable from fixture data alone —
 * "Gather Will can regenerate the Medicinal Plant" is a statement about rules
 * that do not exist until E5. Every rule below is one this phase can actually
 * answer; the rest are listed in `DEFERRED_HARD_ERRORS` with the phase that
 * makes them answerable, so the gap is a record rather than an omission.
 *
 * "Traversable" here means `OPEN`. `DESTRUCTIBLE` counts as blocked, which is
 * exactly its E1 behaviour and exactly what makes rules 3 and 7 meaningful:
 * the world has to work with the Stone Crust intact.
 */

export interface FixtureLintError {
  /** §42 rule number, or a structural check's own id. */
  rule: string;
  message: string;
}

/** §42 rules that need mechanics later phases introduce. */
export const DEFERRED_HARD_ERRORS: Record<string, string> = {
  '6': 'Patrol forcing unavoidable combat — needs the patrol actor (E5)',
  '9': 'Gather Will regenerating the Medicinal Plant — needs Will and resources (E4/E5)',
  '10': 'Both primary Traces obtainable — needs the Take/Trace grammar (E6)',
  '11': 'Insight unlocking without evidence — needs the mystery weave (E6)',
  '12': 'Old marked ridge breakable before Insight — needs terrain destruction (E3/E6)',
  '13': 'Memory Spark revealing what lies beyond the ridge — needs Insight (E6)',
  '14': 'Known Travel traversing UNKNOWN topology — needs Trail Imprint (E7)',
  '15': 'Accelerated travel passing a Frayed gate — needs Known Travel (E7)',
  '16': 'Combat detection skipped during accelerated travel — needs Known Travel (E7)',
  '19': 'World Pulse response budget — needs World Pulse (E5)',
  '20': 'Preview/execution traversal parity — needs the route preview contract (E2)',
};

const OPEN_ONLY = (hex: FixtureHex) => hex.traversal === 'OPEN';
const OPEN_OR_CRUST = (hex: FixtureHex) =>
  hex.traversal === 'OPEN' || hex.terrain === 'STONE_CRUST';

/**
 * Shortest hop count between two authored hexes, or null when no route
 * exists. Only hexes the fixture actually authored are walkable — the
 * technical grid around them is not a shortcut through nowhere.
 */
function shortestRoute(
  fixture: WorldFixture,
  from: IHexCoordinates,
  to: IHexCoordinates,
  canEnter: (hex: FixtureHex) => boolean,
): number | null {
  const byKey = indexFixtureHexes(fixture);
  const targetKey = coordinateKey(to);
  const visited = new Set<string>([coordinateKey(from)]);
  let frontier: IHexCoordinates[] = [from];
  let distance = 0;

  while (frontier.length) {
    if (visited.has(targetKey)) return distance;

    const next: IHexCoordinates[] = [];
    for (const coordinates of frontier) {
      for (const neighbor of getOddQNeighbors(coordinates)) {
        const key = coordinateKey(neighbor);
        if (visited.has(key)) continue;

        const hex = byKey.get(key);
        if (!hex || !canEnter(hex)) continue;

        visited.add(key);
        next.push(neighbor);
      }
    }
    frontier = next;
    distance += 1;
  }

  // Unreachable target: every ring was expanded and the loop's own check
  // never fired.
  return null;
}

function requireHex(fixture: WorldFixture, id: string): FixtureHex {
  const hex = fixture.hexes.find((candidate) => candidate.id === id);
  if (!hex) throw new Error(`Fixture ${fixture.fixtureId} has no hex '${id}'.`);
  return hex;
}

/** Hexes the hero can stand on to interact with a blocked one. */
function approachesTo(fixture: WorldFixture, target: FixtureHex): IHexCoordinates[] {
  const byKey = indexFixtureHexes(fixture);
  return getOddQNeighbors(target.coordinates).filter((coordinates) => {
    const hex = byKey.get(coordinateKey(coordinates));
    return Boolean(hex && hex.traversal === 'OPEN');
  });
}

function canReachAny(
  fixture: WorldFixture,
  from: IHexCoordinates,
  targets: IHexCoordinates[],
  canEnter: (hex: FixtureHex) => boolean,
): boolean {
  return targets.some((target) => shortestRoute(fixture, from, target, canEnter) !== null);
}

function checkStructure(fixture: WorldFixture, errors: FixtureLintError[]): void {
  const seenIds = new Set<string>();
  const seenCoordinates = new Set<string>();

  for (const hex of fixture.hexes) {
    if (seenIds.has(hex.id)) errors.push({ rule: 'S1', message: `duplicate hex id '${hex.id}'` });
    seenIds.add(hex.id);

    const key = coordinateKey(hex.coordinates);
    if (seenCoordinates.has(key)) {
      errors.push({ rule: 'S2', message: `two hexes share coordinate ${key} ('${hex.id}')` });
    }
    seenCoordinates.add(key);

    const { columnIndex, rowIndex } = hex.coordinates;
    if (columnIndex >= fixture.grid.width || rowIndex >= fixture.grid.height) {
      errors.push({
        rule: 'S3',
        message: `hex '${hex.id}' at ${key} falls outside the technical grid`,
      });
    }
  }

  // Terrain and traversal are separate axes, but not independent ones: solid
  // rock that is walkable, or crust that is not the destructible thing the
  // shortcut depends on, is an authoring slip rather than a design choice.
  for (const hex of fixture.hexes) {
    if (hex.terrain === 'STONE_MASS' && hex.traversal !== 'BLOCKED') {
      errors.push({ rule: 'S4', message: `'${hex.id}' is STONE_MASS but not BLOCKED` });
    }
    if (hex.terrain === 'STONE_CRUST' && hex.traversal !== 'DESTRUCTIBLE') {
      errors.push({ rule: 'S4', message: `'${hex.id}' is STONE_CRUST but not DESTRUCTIBLE` });
    }
    if (hex.terrain === 'CAMP' && hex.traversal !== 'OPEN') {
      errors.push({ rule: 'S4', message: `'${hex.id}' is CAMP but not OPEN` });
    }
  }

  if (!indexFixtureHexes(fixture).has(coordinateKey(fixture.worldEntry))) {
    errors.push({ rule: 'S5', message: 'worldEntry is not an authored hex' });
  }
}

/**
 * §42.18 — the technical grid must not become visually exposed.
 *
 * What that means for authored data: the hexes the player starts able to see
 * have to form one connected island. A known hex floating on its own reads as
 * a cell on a board, which is the exact failure I13 names.
 */
function checkStartingIsland(fixture: WorldFixture, errors: FixtureLintError[]): void {
  const known = fixture.hexes.filter((hex) => hex.initialDiscovery !== 'UNKNOWN');
  if (!known.length) {
    errors.push({ rule: '18', message: 'no hex is known at world entry' });
    return;
  }

  const knownKeys = new Set(known.map((hex) => coordinateKey(hex.coordinates)));
  const visited = new Set<string>([coordinateKey(known[0].coordinates)]);
  const queue: IHexCoordinates[] = [known[0].coordinates];

  while (queue.length) {
    const coordinates = queue.shift() as IHexCoordinates;
    for (const neighbor of getOddQNeighbors(coordinates)) {
      const key = coordinateKey(neighbor);
      if (!knownKeys.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }

  if (visited.size !== knownKeys.size) {
    const orphans = [...knownKeys].filter((key) => !visited.has(key));
    errors.push({
      rule: '18',
      message: `starting known space is not one island — detached hexes at ${orphans.join(', ')}`,
    });
  }
}

function checkRoutes(fixture: WorldFixture, errors: FixtureLintError[]): void {
  const camp = requireHex(fixture, 'camp_world_anchor');
  const spire = requireHex(fixture, 'broken_spire');
  const medicinal = requireHex(fixture, 'medicinal_habitat');
  const entry = fixture.worldEntry;

  // 1 — Camp must reach Region A with starting capabilities (no tools).
  const regionA = fixture.hexes.filter((hex) => hex.region === 'REGION_A' && OPEN_ONLY(hex));
  if (
    !canReachAny(
      fixture,
      entry,
      regionA.map((hex) => hex.coordinates),
      OPEN_ONLY,
    )
  ) {
    errors.push({ rule: '1', message: 'Camp cannot reach Region A without tools' });
  }

  // 2 — the Spire must be reachable by at least one legal route. Its own hex
  // is a structure, so "reached" means standing next to it.
  const spireApproaches = approachesTo(fixture, spire);
  if (!spireApproaches.length) {
    errors.push({ rule: '2', message: 'Broken Spire has no open hex to approach it from' });
  } else if (!canReachAny(fixture, entry, spireApproaches, OPEN_ONLY)) {
    errors.push({ rule: '2', message: 'Broken Spire is unreachable by any legal route' });
  }

  // 3 — the Stone Crust shortcut must never be the only way through. This is
  // rule 2 again with the crust intact, which is already how OPEN_ONLY treats
  // it; stating it separately is what makes a future edit that quietly makes
  // the shortcut mandatory fail with the right message.
  const withCrustIntact = spireApproaches.length
    ? Math.min(
        ...spireApproaches
          .map((target) => shortestRoute(fixture, entry, target, OPEN_ONLY))
          .filter((distance): distance is number => distance !== null),
        Infinity,
      )
    : Infinity;
  if (!isFinite(withCrustIntact)) {
    errors.push({ rule: '3', message: 'Stone Crust shortcut is mandatory — no fallback route' });
  }

  // 4 and 7 — breaking the crust has to actually buy something. If the route
  // through it is no shorter than the long way round, the shortcut is a
  // decoration and the fork it creates is a fake decision.
  const withCrustBroken = spireApproaches.length
    ? Math.min(
        ...spireApproaches
          .map((target) => shortestRoute(fixture, entry, target, OPEN_OR_CRUST))
          .filter((distance): distance is number => distance !== null),
        Infinity,
      )
    : Infinity;
  if (isFinite(withCrustIntact) && !(withCrustBroken < withCrustIntact)) {
    errors.push({
      rule: '7',
      message:
        `breaking Stone Crust opens no better passage ` +
        `(${withCrustBroken} steps vs ${withCrustIntact} intact)`,
    });
  }

  // 5 — the Medicinal Plant must be reachable. Whether it can be *taken* is
  // E4's question; whether the player can stand on it is this one's.
  if (shortestRoute(fixture, entry, medicinal.coordinates, OPEN_ONLY) === null) {
    errors.push({ rule: '5', message: 'Medicinal Plant habitat is unreachable' });
  }

  // 8 — the patrol must not be able to walk through intact Stone Crust: its
  // own path has to be connected without it.
  const patrolHexes = fixture.hexes.filter((hex) => hex.id.startsWith('patrol_p'));
  const patrolStart = patrolHexes[0];
  if (patrolStart) {
    const disconnected = patrolHexes.filter(
      (hex) => shortestRoute(fixture, patrolStart.coordinates, hex.coordinates, OPEN_ONLY) === null,
    );
    if (disconnected.length) {
      errors.push({
        rule: '8',
        message: `patrol path only connects through Stone Crust: ${disconnected
          .map((hex) => hex.id)
          .join(', ')}`,
      });
    }
  }

  // 17 — the way home must exist without an authored fallback being needed.
  if (shortestRoute(fixture, spireApproaches[0] ?? entry, camp.coordinates, OPEN_ONLY) === null) {
    errors.push({ rule: '17', message: 'return to Camp is impossible from the Spire approach' });
  }
}

/** Every hard error the fixture currently violates. Empty means the fixture is legal. */
export function lintWorldFixture(fixture: WorldFixture): FixtureLintError[] {
  const errors: FixtureLintError[] = [];

  checkStructure(fixture, errors);
  checkStartingIsland(fixture, errors);
  checkRoutes(fixture, errors);

  return errors;
}

/** Throwing form, for a build/dev-time gate. */
export function assertWorldFixtureIsLegal(fixture: WorldFixture): void {
  const errors = lintWorldFixture(fixture);
  if (!errors.length) return;

  throw new Error(
    `Fixture ${fixture.fixtureId} failed ${errors.length} hard error(s):\n` +
      errors.map((error) => `  [§42.${error.rule}] ${error.message}`).join('\n'),
  );
}
