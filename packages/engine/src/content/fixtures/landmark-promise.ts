import { coordinateKey } from '../../utils/hex-utils';
import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import type { Bearing, WorldFixture } from './world-fixture-schema';

/**
 * A landmark the player can *see* but has not located: a shape on the horizon
 * and a direction to walk in.
 *
 * This type is the whole of block 6's guarantee, expressed as a shape rather
 * than as a rule someone has to remember. There is no coordinate field, so a
 * consumer cannot highlight the hex; there is no distance field, so nothing
 * can render "11 hexes"; and producing one of these does not touch any tile's
 * `discovery`, so the Broken Spire's own hex stays `UNKNOWN` while the promise
 * is on screen. Design §17 draws exactly this line, and invariant I3 (unknown
 * information privacy) is what it protects.
 */
export interface LandmarkPromise {
  /** i18n key for the silhouette line. Resolved in apps/web, never read here. */
  silhouetteKey: string;
  /** Which way it lies, in the flat-top compass the board actually renders. */
  bearing: Bearing;
}

/**
 * Every distant-landmark promise visible from `from`.
 *
 * Pure and authored: it reads the fixture's `distantObservation` entries and
 * returns nothing the author did not write. It does not compute visibility
 * from geometry, and it does not read or write discovery state.
 */
export function resolveLandmarkPromises(
  fixture: WorldFixture,
  from: IHexCoordinates,
): LandmarkPromise[] {
  const fromKey = coordinateKey(from);
  const promises: LandmarkPromise[] = [];

  for (const hex of fixture.hexes) {
    const observation = hex.distantObservation;
    if (!observation) continue;

    for (const sighting of observation.bearingFrom) {
      if (coordinateKey(sighting.from) !== fromKey) continue;
      promises.push({ silhouetteKey: observation.silhouetteKey, bearing: sighting.bearing });
    }
  }

  return promises;
}
