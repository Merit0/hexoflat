import type { ExitSide } from '../boards/exits';
import { planBoardCrossing } from '../hero-movement/board-crossing';
import { getMeta } from '../content';
import { EHexActionType } from '../enums/hex-action-type';
import type { StartHexActionCommand } from '../commands/hex-engine-commands';
import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import type { ProgressState } from '../aggregates/progress-state';
import { revealAroundHero, revealEntryTile } from '../map/fog-service';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import type { LocationKey } from '../registry/world-map-registry';
import { deriveStream } from '../utils/random-seeded';
import { coordinateKey, hexDistance } from '../utils/hex-utils';
import { findArrivalHex } from './hero-placement';
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
    arrivalSide = plan.crossing.arrivalSide;
    resting = plan.crossing.restingSpot;
  } else {
    const tile = world.map.tiles.find(
      (candidate) => coordinateKey(candidate.coordinates) === coordinateKey(via.coordinates),
    );
    const key = tile?.hexobject?.hexobjectKey;
    const enter = key ? getMeta(key)?.enter : undefined;
    if (!tile || enter?.type !== 'WORLD') return refuse('NOT_A_GATE');
    if (hexDistance(position, via.coordinates) > 1) return refuse('TOO_FAR');
    to = enter.locationKey;
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
      : destination.heroCoordinates;
  destination.heroCoordinates = arrival ? { ...arrival } : { columnIndex: 0, rowIndex: 0 };
  revealAroundHero(destination.map, destination.heroCoordinates);
  revealEntryTile(destination.map);

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
