import { applyCommand, type HexEngineState } from '../commands/apply-command';
import type { DomainEvent } from '../commands/types';
import { closePortalIfOpen } from '../portal/apply-portal';
import { findPortalSpot, placeReturnPortal } from '../portal/portal-placement';
import type { PortalLink } from '../portal/portal-state';
import { revealAroundHero, revealEntryTile } from '../map/fog-service';
import { findFreeHexNear } from '../map/free-hex-finder';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '../registry/location-key';
import { createRecordingPorts } from './server-ports';
import type { ServerWorld } from './server-world';
import { diffTiles, snapshotTiles } from './tile-diff';
import type { TravelOutcome } from './travel';
import { leaveOrigin, removeClosedPortals, type WorldFinders } from './world-leave';
import {
  heroOf,
  locationOf,
  refuse,
  stateOf,
  type WorldOutcome,
  type WorldRun,
} from './world-commands';

export interface PortalRun extends WorldRun, WorldFinders {}

function reasonOf(events: DomainEvent[], type: string): string {
  const rejected = events.find((event) => event.type === type);
  return (rejected?.payload as { reason?: string } | undefined)?.reason ?? 'REJECTED';
}

export function openPortalWorld(run: WorldRun, target: IHexCoordinates): WorldOutcome {
  const hero = heroOf(run);
  if (!hero) return refuse('NO_POSITION');
  const world: ServerWorld = { ...run.world };
  const progress = structuredClone(run.progress);
  const inventory = structuredClone(run.inventory);
  const before = snapshotTiles(world.map);
  const state = stateOf({ ...run, world, progress, inventory }, hero);
  const { ctx, effects } = createRecordingPorts(run.client);
  const { events } = applyCommand(
    state,
    { type: 'OPEN_PORTAL', payload: { heroId: run.heroId, target } },
    ctx,
  );
  if (!events.some((event) => event.type === 'PORTAL_OPENED')) {
    return refuse(reasonOf(events, 'PORTAL_OPEN_REJECTED'), events, effects);
  }
  progress.portal = hero.portal ?? null;
  return {
    ok: true,
    world,
    progress,
    inventory: state.inventory ?? inventory,
    events,
    tileDiffs: diffTiles(before, world.map),
    effects,
  };
}

export function enterPortalWorld(run: PortalRun): TravelOutcome {
  const { world, now } = run;
  const progress = structuredClone(run.progress);
  const hero = heroOf({ ...run, progress });
  if (!hero) return { ok: false, code: 'NO_POSITION', events: [], effects: [] };
  const state: HexEngineState = {
    map: world.map,
    heroes: { [run.heroId]: hero },
    location: locationOf(world),
  };
  const { events } = applyCommand(
    state,
    { type: 'ENTER_PORTAL', payload: { heroId: run.heroId } },
    createRecordingPorts().ctx,
  );
  const entered = events.find((event) => event.type === 'PORTAL_ENTERED');
  if (!entered) {
    return { ok: false, code: reasonOf(events, 'PORTAL_ENTER_REJECTED'), events, effects: [] };
  }
  const { to, toMapId, arrivalNear } = entered.payload as {
    to: LocationKey;
    toMapId: string | null;
    arrivalNear: IHexCoordinates | null;
  };
  const replaced = leaveOrigin(run, progress, world, now);
  const destination =
    (to === 'camping' ? run.loadStored('camping') : toMapId ? run.loadById(toMapId) : null) ??
    run.create(to);
  const closed = events.some((event) => event.type === 'PORTAL_CLOSED');
  const link: PortalLink | null = hero.portal ?? null;
  let anchor = arrivalNear;
  if (!closed && link?.campHex) {
    const spot = findPortalSpot(
      destination.map,
      link.campHex,
      destination.heroCoordinates ? [destination.heroCoordinates] : [],
    );
    if (spot && placeReturnPortal(destination.map, spot)) {
      anchor = spot;
      hero.portal = { ...link, campHex: spot };
    }
  }
  const stand = anchor ? findFreeHexNear(destination.map, anchor) : null;
  destination.heroCoordinates = stand ??
    destination.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 };
  revealAroundHero(destination.map, destination.heroCoordinates);
  revealEntryTile(destination.map);
  const touched = removeClosedPortals(events, [world, destination], run);
  progress.portal = hero.portal ?? null;
  progress.presence = {
    locationKey: to,
    mapId: destination.mapId,
    coordinates: { ...destination.heroCoordinates },
  };
  events.push({
    type: 'WORLD_TRAVELLED',
    payload: { heroId: run.heroId, from: world.locationKey, to, via: 'portal' },
  });
  return {
    ok: true,
    origin: world,
    destination,
    replaced,
    touched,
    progress,
    inventory: run.inventory,
    events,
    effects: [],
  };
}

export function closePortalWorld(
  run: WorldRun & Pick<WorldFinders, 'loadStored' | 'loadById'>,
): WorldOutcome {
  const progress = structuredClone(run.progress);
  const hero = heroOf({ ...run, progress });
  if (!hero) return refuse('NO_POSITION');
  const world: ServerWorld = { ...run.world };
  const before = snapshotTiles(world.map);
  const events = closePortalIfOpen({ map: world.map, heroes: { [run.heroId]: hero } }, run.heroId, {
    kind: 'DEATH',
  });
  if (events.length === 0) return refuse('NO_PORTAL');
  const touched = removeClosedPortals(events, [world], run);
  progress.portal = null;
  return {
    ok: true,
    world,
    progress,
    inventory: run.inventory,
    events,
    tileDiffs: diffTiles(before, world.map),
    effects: [],
    touched,
  };
}
