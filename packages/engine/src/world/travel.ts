import { gateConnects } from '../dimensions/world-connections';
import { LOCATION_DIMENSIONS } from '../registry/location-key';
import { heroFogRadius } from '../map/hero-fog';
import type { ExitSide } from '../boards/exits';
import { planBoardCrossing } from '../hero-movement/board-crossing';
import { objectActionDestination, objectTransitionRefusal } from '../map/object-transition';
import { EHexActionType } from '../enums/hex-action-type';
import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import type { ProgressState } from '../aggregates/progress-state';
import { revealAroundHero, revealEntryTile } from '../map/fog-service';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { BoardKind } from '../registry/board-kind';
import { MapRegistry, type LocationKey } from '../registry/world-map-registry';
import { assertNever } from '../utils/assert-never';
import { deriveStream } from '../utils/random-seeded';
import { coordinateKey } from '../utils/hex-utils';
import { findArrivalHex, findEntryHex } from './hero-placement';
import type { ServerWorld } from './server-world';
import type { WorldEffect } from './server-ports';
import { closePortalIfOpen } from '../portal/apply-portal';
import { leaveOrigin, removeClosedPortals, type WorldFinders } from './world-leave';
import { actWorld, type WorldRun } from './world-commands';

export type TravelVia = { kind: 'exit' } | { kind: 'gate'; coordinates: IHexCoordinates };

export interface TravelRun extends WorldRun, WorldFinders {}

export type TravelOutcome =
  | {
      ok: true;
      origin: ServerWorld;
      destination: ServerWorld;
      replaced: ServerWorld | null;
      touched: ServerWorld[];
      progress: ProgressState;
      inventory: InventoryState;
      events: DomainEvent[];
      effects: WorldEffect[];
    }
  | { ok: false; code: string; events: DomainEvent[]; effects: WorldEffect[] };

function refuse(
  code: string,
  events: DomainEvent[] = [],
  effects: WorldEffect[] = [],
): TravelOutcome {
  return { ok: false, code, events, effects };
}

function isSealed(progress: ProgressState, locationKey: LocationKey, now: number): boolean {
  return (progress.sealedUntil[locationKey] ?? 0) > now;
}

export function travelWorld(run: TravelRun, via: TravelVia): TravelOutcome {
  const { world, now } = run;
  const position = world.heroCoordinates;
  if (!position) return refuse('NO_POSITION');
  if (world.battle) return refuse('BATTLE_OPEN');
  let progress = structuredClone(run.progress);
  let inventory = run.inventory;
  let events: DomainEvent[] = [];
  let effects: WorldEffect[] = [];
  let to: LocationKey;
  let arrivalSide: ExitSide | null = null;
  let resting: IHexCoordinates | null = null;

  if (via.kind === 'exit') {
    const plan = planBoardCrossing(world.map, position, world.locationKey, {
      combatActive: false,
      isLocationSealed: (locationKey) => isSealed(progress, locationKey, now),
    });
    if (!plan.ok) return refuse(plan.reason);
    to = plan.crossing.to;
    if (LOCATION_DIMENSIONS[world.locationKey] !== LOCATION_DIMENSIONS[to])
      return refuse('DIMENSION_RELATION_FORBIDDEN');
    arrivalSide = plan.crossing.arrivalSide;
    resting = plan.crossing.restingSpot;
  } else {
    const tile = world.map.tiles.find(
      (candidate) => coordinateKey(candidate.coordinates) === coordinateKey(via.coordinates),
    );
    const enter = objectActionDestination(tile?.hexobject, EHexActionType.ENTER);
    if (!tile || enter?.type !== 'WORLD') return refuse('NOT_A_GATE');
    const blocked = objectTransitionRefusal(
      tile,
      position,
      !!world.engagement,
      EHexActionType.ENTER,
      HEXOBJECT_KEYS.HAND,
      true,
    );
    if (blocked) return refuse(blocked);
    to = enter.locationKey;
    if (!gateConnects(world.locationKey, to, tile.hexobject!.hexobjectKey))
      return refuse('DIMENSION_RELATION_FORBIDDEN');
    if (isSealed(progress, to, now)) return refuse('SEALED');
    const charge = actWorld(
      { ...run, progress },
      {
        heroId: run.heroId,
        coordinates: via.coordinates,
        actionType: EHexActionType.ENTER,
        toolKey: HEXOBJECT_KEYS.HAND,
        now,
      },
    );
    if (!charge.ok) return refuse(charge.code, charge.events, charge.effects);
    progress = charge.progress;
    inventory = charge.inventory;
    events = charge.events;
    effects = charge.effects;
  }

  const origin = world;
  const hero = {
    id: run.heroId,
    controlledBy: null,
    coordinates: { ...position },
    heroSteps: progress.steps,
    portal: progress.portal,
  };
  const closure = closePortalIfOpen(
    { map: origin.map, heroes: { [run.heroId]: hero } },
    run.heroId,
    {
      kind: 'GATE',
    },
  );
  progress.portal = hero.portal;
  events.push(...closure);
  const replaced = leaveOrigin(run, progress, origin, now);
  const due = progress.sealedUntil[to];
  if (due !== undefined && due <= now) delete progress.sealedUntil[to];

  const destination = (due === undefined ? run.loadStored(to) : null) ?? run.create(to);
  const touched = removeClosedPortals(closure, [origin, destination], run);
  origin.heroCoordinates = { ...(resting ?? position) };

  const arrival =
    via.kind === 'exit'
      ? (findArrivalHex(
          destination.map,
          arrivalSide,
          deriveStream(destination.worldSeed, `arrive:${progress.steps}`),
        ) ?? destination.heroCoordinates)
      : (findEntryHex(
          destination.map,
          to,
          deriveStream(destination.worldSeed, `arrive:${progress.steps}`),
          origin.locationKey,
        ) ?? destination.heroCoordinates);
  destination.heroCoordinates = arrival ? { ...arrival } : { columnIndex: 0, rowIndex: 0 };
  revealAroundHero(destination.map, destination.heroCoordinates, heroFogRadius(inventory));
  revealEntryTile(destination.map);

  if (countsAsTrip(MapRegistry.get(to).boardKind)) progress.trips += 1;
  progress.presence = {
    locationKey: to,
    mapId: destination.mapId,
    coordinates: { ...destination.heroCoordinates },
  };
  events.push({
    type: 'WORLD_TRAVELLED',
    payload: { heroId: run.heroId, from: origin.locationKey, to, via: via.kind },
  });
  return { ok: true, origin, destination, replaced, touched, progress, inventory, events, effects };
}

function countsAsTrip(kind: BoardKind): boolean {
  switch (kind) {
    case 'DUNGEON':
      return true;
    case 'STATIC':
      return false;
    default:
      return assertNever(kind);
  }
}
