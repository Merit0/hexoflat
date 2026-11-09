import { applyCommand, type HexEngineState } from '../commands/apply-command';
import type { StartHexActionCommand } from '../commands/hex-engine-commands';
import type { DomainEvent } from '../commands/types';
import type { HeroState } from '../hero-movement/hero-state';
import { isEnterableTile } from '../hero-movement/move-planner';
import type { InventoryState } from '../inventory/inventory-state';
import {
  executeProgressCommand,
  serverKnowledgeContext,
} from '../aggregates/execute-progress-command';
import type { PlayerCommand } from '../aggregates/player-commands';
import type { ProgressState } from '../aggregates/progress-state';
import { revealAroundHero } from '../map/fog-service';
import { MapRegistry } from '../registry/world-map-registry';
import { hexDistance } from '../utils/hex-utils';
import { createRecordingPorts, type WorldClientHint, type WorldEffect } from './server-ports';
import type { ServerWorld } from './server-world';
import { diffTiles, snapshotTiles, type TileDiff } from './tile-diff';

export interface WorldRun {
  world: ServerWorld;
  progress: ProgressState;
  inventory: InventoryState;
  heroId: string;
  now: number;
  client?: WorldClientHint;
}

export type WorldOutcome =
  | {
      ok: true;
      world: ServerWorld;
      progress: ProgressState;
      inventory: InventoryState;
      events: DomainEvent[];
      tileDiffs: TileDiff[];
      effects: WorldEffect[];
    }
  | { ok: false; code: string; events: DomainEvent[] };

function heroOf(run: WorldRun): HeroState | null {
  const { heroCoordinates } = run.world;
  if (!heroCoordinates) return null;
  return {
    id: run.heroId,
    controlledBy: null,
    coordinates: { ...heroCoordinates },
    heroSteps: run.progress.steps,
    portal: null,
  };
}

function refuse(code: string, events: DomainEvent[] = []): WorldOutcome {
  return { ok: false, code, events };
}

function locationOf(world: ServerWorld) {
  return {
    locationKey: world.locationKey,
    mapId: world.mapId,
    boardKind: MapRegistry.get(world.locationKey).boardKind,
  };
}

function stateOf(run: WorldRun, hero: HeroState): HexEngineState {
  const presence = {
    locationKey: run.world.locationKey,
    mapId: run.world.mapId,
    coordinates: { ...hero.coordinates },
  };
  return {
    map: run.world.map,
    heroes: { [run.heroId]: hero },
    knowledge: run.progress.knowledge,
    knowledgeContext: serverKnowledgeContext(presence),
    location: locationOf(run.world),
    inventory: run.inventory,
    inventoryContext: { stashOpen: false, battleOpen: false },
    engagement: run.world.engagement ?? undefined,
  };
}

export function tickWorld(run: WorldRun): WorldOutcome {
  const hero = heroOf(run);
  if (!hero) return refuse('NO_POSITION');
  const world: ServerWorld = { ...run.world, map: run.world.map };
  const progress = structuredClone(run.progress);
  const before = snapshotTiles(world.map);
  const state = stateOf({ ...run, world, progress }, hero);
  const { ctx, effects } = createRecordingPorts(run.client);
  const { events } = applyCommand(state, { type: 'WORLD_TICK', payload: { now: run.now } }, ctx);
  return {
    ok: true,
    world,
    progress,
    inventory: state.inventory ?? run.inventory,
    events,
    tileDiffs: diffTiles(before, world.map),
    effects,
  };
}

export function stepWorld(
  run: WorldRun,
  target: { columnIndex: number; rowIndex: number },
): WorldOutcome {
  const hero = heroOf(run);
  if (!hero) return refuse('NO_POSITION');
  if (hexDistance(hero.coordinates, target) !== 1) return refuse('INVALID_STEP');
  if (!isEnterableTile(run.world.map, target)) return refuse('BLOCKED');

  const before = snapshotTiles(run.world.map);
  const planning: HexEngineState = {
    map: run.world.map,
    heroes: { [run.heroId]: { ...hero, coordinates: { ...hero.coordinates } } },
    engagement: run.world.engagement ?? undefined,
  };
  const { events: moved } = applyCommand(
    planning,
    { type: 'MOVE_HERO', payload: { heroId: run.heroId, target } },
    createRecordingPorts().ctx,
  );
  if (!moved.some((event) => event.type === 'HERO_MOVED')) return refuse('UNREACHABLE', moved);

  const progress = structuredClone(run.progress);
  progress.presence = {
    locationKey: run.world.locationKey,
    mapId: run.world.mapId,
    coordinates: { ...hero.coordinates },
  };
  const stepCommand = {
    type: 'KNOWLEDGE',
    payload: {
      heroId: run.heroId,
      revision: progress.knowledge.revision,
      action: { kind: 'step', target },
    },
  } as PlayerCommand;
  const paid = executeProgressCommand(progress, stepCommand);
  if (!paid || !paid.ok)
    return refuse(paid && !paid.ok ? paid.code : 'REJECTED', paid?.events ?? []);

  const world: ServerWorld = {
    ...run.world,
    heroCoordinates: { ...target },
    engagement: planning.engagement ?? run.world.engagement,
  };
  revealAroundHero(world.map, target);
  return {
    ok: true,
    world,
    progress: paid.progress,
    inventory: run.inventory,
    events: [...moved, ...paid.events],
    tileDiffs: diffTiles(before, world.map),
    effects: [],
  };
}

export function actWorld(run: WorldRun, command: StartHexActionCommand['payload']): WorldOutcome {
  const hero = heroOf(run);
  if (!hero) return refuse('NO_POSITION');
  if (hexDistance(hero.coordinates, command.coordinates) > 1) return refuse('TOO_FAR');

  const world: ServerWorld = { ...run.world, map: run.world.map };
  const progress = structuredClone(run.progress);
  const inventory = structuredClone(run.inventory);
  const before = snapshotTiles(world.map);
  const state = stateOf({ ...run, world, progress, inventory }, hero);
  const { ctx, effects } = createRecordingPorts(run.client);
  const { events } = applyCommand(
    state,
    { type: 'START_HEX_ACTION', payload: { ...command, heroId: run.heroId, now: run.now } },
    ctx,
  );
  if (events.some((event) => event.type === 'HEX_ACTION_START_REJECTED')) {
    return refuse('ACTION_REJECTED', events);
  }
  world.engagement = state.engagement ?? world.engagement;
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
