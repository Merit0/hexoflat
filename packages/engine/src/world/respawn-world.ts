import { heroFogRadius } from '../map/hero-fog';
import { revealAroundHero, revealEntryTile } from '../map/fog-service';
import { closePortalIfOpen } from '../portal/apply-portal';
import type { BoardKind } from '../registry/board-kind';
import { MapRegistry } from '../registry/world-map-registry';
import { assertNever } from '../utils/assert-never';
import type { ServerWorld } from './server-world';
import { removeClosedPortals } from './world-leave';
import { heroOf } from './world-commands';
import type { TravelOutcome, TravelRun } from './travel';

const RESPAWN_LOCATION = 'camping';
const RESPAWN_HEARTS = 1;

export function respawnWorld(run: TravelRun): TravelOutcome {
  const { world: origin } = run;
  const progress = structuredClone(run.progress);
  const hero = heroOf({ ...run, progress });
  if (!hero) return { ok: false, code: 'NO_POSITION', events: [], effects: [] };

  const closure = closePortalIfOpen(
    { map: origin.map, heroes: { [run.heroId]: hero } },
    run.heroId,
    { kind: 'DEATH' },
  );
  progress.portal = hero.portal ?? null;
  origin.battle = null;
  origin.engagement = null;

  const inCamp = origin.locationKey === RESPAWN_LOCATION;
  const replaced =
    !inCamp && freshAfterDeath(MapRegistry.get(origin.locationKey).boardKind)
      ? run.create(origin.locationKey)
      : null;
  const destination: ServerWorld = inCamp
    ? origin
    : (run.loadStored(RESPAWN_LOCATION) ?? run.create(RESPAWN_LOCATION));
  const touched = removeClosedPortals(closure, [origin, destination], run);

  destination.heroCoordinates = destination.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 };
  revealAroundHero(destination.map, destination.heroCoordinates, heroFogRadius(run.inventory));
  revealEntryTile(destination.map);

  progress.health.current = RESPAWN_HEARTS;
  progress.presence = {
    locationKey: RESPAWN_LOCATION,
    mapId: destination.mapId,
    coordinates: { ...destination.heroCoordinates },
  };
  const events = [
    ...closure,
    {
      type: 'HERO_RESPAWNED',
      payload: { heroId: run.heroId, from: origin.locationKey, to: RESPAWN_LOCATION },
    },
  ];
  return {
    ok: true,
    origin,
    destination,
    replaced,
    touched,
    progress,
    inventory: run.inventory,
    events,
    effects: [],
  };
}

function freshAfterDeath(kind: BoardKind): boolean {
  switch (kind) {
    case 'DUNGEON':
      return true;
    case 'STATIC':
      return false;
    default:
      return assertNever(kind);
  }
}
