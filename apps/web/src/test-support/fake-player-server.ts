import {
  AGGREGATES,
  PLAYER_COMMAND_AGGREGATES,
  PLAYER_COMMAND_REVISION,
  PLAYER_COMMAND_SCHEMAS,
  executePlayerCommand,
  isPlayerCommandType,
  serverInventoryContext,
  serverTradeContext,
  type PlayerAggregates,
} from '@hexoflat/engine';
import {
  actWorld,
  battleWorld,
  closePortalWorld,
  enterPortalWorld,
  openPortalWorld,
  createServerWorld,
  serializeWorld,
  travelWorld,
  stepWorld,
  tickWorld,
  type ServerWorld,
  type WorldClientHint,
} from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { projectWorldForClient } from '@hexoflat/engine/world/client-projection';
import type {
  HeroSnapshot,
  PlayerCommandResponse,
  PlayerEnvelope,
} from '@/services/player/player-socket';

interface Store {
  heroId: string;
  inventory: { revision: number; state: PlayerAggregates['inventory'] };
  progress: { revision: number; state: PlayerAggregates['progress'] };
}

export const FAKE_RNG_SEED = 'fake-player-server-rng-seed';

let store: Store | null = null;
let world: ServerWorld | null = null;
const storedWorlds = new Map<string, ServerWorld>();
export const sentCommands: PlayerEnvelope[] = [];

export function resetFakePlayerServer(
  heroId: string,
  tweak?: (progress: PlayerAggregates['progress']) => void,
): void {
  const progress = AGGREGATES.progress.createInitial({ heroId });
  tweak?.(progress);
  store = {
    heroId,
    inventory: { revision: 0, state: AGGREGATES.inventory.createInitial({ heroId }) },
    progress: { revision: 0, state: progress },
  };
  sentCommands.length = 0;
  world = null;
  storedWorlds.clear();
}

function projectProgress(progress: Store['progress']) {
  return {
    revision: progress.revision,
    state: AGGREGATES.progress.project(progress.state, { rngSeed: FAKE_RNG_SEED }),
  };
}

export function snapshot(): HeroSnapshot {
  const s = store!;
  return {
    heroId: s.heroId,
    aggregates: {
      inventory: { revision: s.inventory.revision, state: s.inventory.state },
      progress: projectProgress(s.progress),
    },
  };
}

function handle(envelope: PlayerEnvelope): PlayerCommandResponse {
  sentCommands.push(envelope);
  const s = store!;
  const respond = (
    result: PlayerCommandResponse['result'],
    code?: string,
    events: PlayerCommandResponse['events'] = [],
  ) => ({
    commandId: envelope.commandId,
    result,
    ...(code ? { code } : {}),
    events,
    aggregates: snapshot().aggregates,
  });
  const type = envelope.command.type;
  if (!isPlayerCommandType(type)) return respond('rejected', 'UNKNOWN_COMMAND');
  const parsed = PLAYER_COMMAND_SCHEMAS[type].safeParse(envelope.command);
  if (!parsed.success) return respond('rejected', 'INVALID_COMMAND');
  const command = parsed.data;
  const primary = PLAYER_COMMAND_AGGREGATES[command.type][0];
  if (s[primary].revision !== envelope.expectedRevision)
    return respond('conflict', 'REVISION_CONFLICT');
  if (
    PLAYER_COMMAND_REVISION[command.type] === 'aggregate' &&
    (command.payload as { revision: number }).revision !== envelope.expectedRevision
  ) {
    return respond('rejected', 'INVALID_COMMAND');
  }
  s.inventory.state.revision = s.inventory.revision;
  const outcome = executePlayerCommand(
    { inventory: s.inventory.state, progress: s.progress.state },
    command,
    {
      devGrantAllowed: true,
      inventory: serverInventoryContext(s.progress.state.presence),
      trade: serverTradeContext(s.progress.state.presence, FAKE_RNG_SEED),
    },
  );
  if (!outcome.ok) return respond('rejected', outcome.code, outcome.events);
  const changed: HeroSnapshot['aggregates'] = {};
  if (outcome.changed.inventory) {
    s.inventory = { revision: s.inventory.revision + 1, state: outcome.changed.inventory };
    changed.inventory = { revision: s.inventory.revision, state: s.inventory.state };
  }
  if (outcome.changed.progress) {
    s.progress = { revision: s.progress.revision + 1, state: outcome.changed.progress };
    changed.progress = projectProgress(s.progress);
  }
  return {
    commandId: envelope.commandId,
    result: 'applied',
    events: outcome.events,
    aggregates: changed,
  };
}

export function fakePlayerSocketModule() {
  class PlayerSocketError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  class PlayerSocket {
    connected = true;
    onTakenOver() {}
    connect() {
      return Promise.resolve();
    }
    subscribe() {
      return Promise.resolve(snapshot());
    }
    send(envelope: PlayerEnvelope) {
      return Promise.resolve(handle(envelope));
    }
    sendWorld(envelope: PlayerEnvelope) {
      return Promise.resolve(handleWorld(envelope));
    }
    close() {}
  }
  return { PlayerSocket, PlayerSocketError };
}

export function fakeProgressRow(): Store['progress'] {
  return store!.progress;
}

export function fakeStoredWorld(mapId: string): ServerWorld | null {
  return storedWorlds.get(mapId) ?? null;
}

export function fakeStoredWorldOf(locationKey: string): ServerWorld | null {
  return [...storedWorlds.values()].find((stored) => stored.locationKey === locationKey) ?? null;
}

export function fakePresence() {
  return store!.progress.state.presence;
}

export function fakePlaceHero(at: { columnIndex: number; rowIndex: number }): void {
  const held = world!;
  held.heroCoordinates = { ...at };
  const { presence } = store!.progress.state;
  if (presence) presence.coordinates = { ...at };
}

export function fakeStoreWorld(held: ServerWorld): void {
  for (const [mapId, stored] of storedWorlds) {
    if (stored.locationKey === held.locationKey) storedWorlds.delete(mapId);
  }
  storedWorlds.set(held.mapId, held);
}

export function fakeEnsureWorld(locationKey: string) {
  const known = [...storedWorlds.values()].find((stored) => stored.locationKey === locationKey);
  const held =
    known ??
    createServerWorld(
      locationKey as Parameters<typeof createServerWorld>[0],
      crypto.randomUUID(),
      'fake-seed',
      store!.heroId,
    );
  storedWorlds.set(held.mapId, held);
  return projectWorldForClient(serializeWorld(held));
}

function enterFake(envelope: PlayerEnvelope) {
  sentCommands.push(envelope);
  const s = store!;
  const locationKey = (envelope.command.payload as { locationKey: string }).locationKey;
  const base = { commandId: envelope.commandId, tileDiffs: [], effects: [], events: [] };
  if (s.progress.revision !== envelope.expectedRevision) {
    return {
      ...base,
      result: 'conflict' as const,
      code: 'REVISION_CONFLICT',
      hero: null,
      aggregates: snapshot().aggregates,
    };
  }
  fakeEnsureWorld(locationKey);
  const entered = [...storedWorlds.values()].find((stored) => stored.locationKey === locationKey)!;
  world = entered;
  const next = structuredClone(s.progress.state);
  next.presence = {
    locationKey: entered.locationKey,
    mapId: entered.mapId,
    coordinates: { ...(entered.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 }) },
  };
  s.progress = { revision: s.progress.revision + 1, state: next };
  return {
    ...base,
    result: 'applied' as const,
    hero: null,
    aggregates: snapshot().aggregates,
  };
}

function handleWorld(envelope: PlayerEnvelope) {
  if (envelope.command.type === 'WORLD_ENTER') return enterFake(envelope);
  sentCommands.push(envelope);
  const s = store!;
  const base = { commandId: envelope.commandId, tileDiffs: [], effects: [], events: [] };
  if (s.progress.revision !== envelope.expectedRevision || !world) {
    return {
      ...base,
      result: world ? ('conflict' as const) : ('rejected' as const),
      code: world ? 'REVISION_CONFLICT' : 'NO_WORLD',
      hero: null,
      aggregates: snapshot().aggregates,
    };
  }
  const payload = envelope.command.payload as {
    target: { columnIndex: number; rowIndex: number };
    coordinates: { columnIndex: number; rowIndex: number };
    actionType: never;
    toolKey: string;
    client?: WorldClientHint;
  };
  const run = {
    world,
    progress: s.progress.state,
    inventory: s.inventory.state,
    heroId: s.heroId,
    now: Date.now(),
    client: payload.client,
  };
  const type = envelope.command.type;
  const finders = fakeFinders(run.world);
  if (type === 'WORLD_BATTLE') return battleFake(envelope, base, { ...run, ...finders });
  if (type === 'WORLD_TRAVEL' || type === 'WORLD_PORTAL_ENTER') {
    return travelFake(envelope, base, { ...run, ...finders });
  }
  const outcome =
    type === 'WORLD_STEP'
      ? stepWorld(run, payload.target)
      : type === 'WORLD_ACTION'
        ? actWorld(run, {
            heroId: s.heroId,
            coordinates: payload.coordinates,
            actionType: payload.actionType,
            toolKey: payload.toolKey,
            now: run.now,
          })
        : type === 'WORLD_PORTAL_OPEN'
          ? openPortalWorld(run, payload.target)
          : type === 'WORLD_PORTAL_CLOSE'
            ? closePortalWorld({ ...run, ...finders })
            : tickWorld(run);
  if (!outcome.ok) {
    return {
      ...base,
      events: outcome.events,
      effects: outcome.effects,
      result: 'rejected' as const,
      code: outcome.code,
      hero: null,
      aggregates: snapshot().aggregates,
    };
  }
  world = outcome.world;
  storedWorlds.set(outcome.world.mapId, outcome.world);
  for (const other of outcome.touched ?? []) storedWorlds.set(other.mapId, other);
  s.progress = { revision: s.progress.revision + 1, state: outcome.progress };
  if (outcome.inventory !== s.inventory.state) {
    s.inventory = { revision: s.inventory.revision + 1, state: outcome.inventory };
  }
  return {
    ...base,
    touched: (outcome.touched ?? []).map((other) => ({
      locationKey: other.locationKey,
      world: serializeWorld(other),
    })),
    events: outcome.events,
    tileDiffs: outcome.tileDiffs,
    effects: outcome.effects,
    engagement: outcome.world.engagement,
    result: 'applied' as const,
    hero: null,
    aggregates: snapshot().aggregates,
  };
}

function fakeFinders(current: ServerWorld) {
  return {
    loadStored: (location: string) =>
      [...storedWorlds.values()].find((w) => w.locationKey === location && w !== current) ?? null,
    loadById: (mapId: string) => {
      const held = storedWorlds.get(mapId) ?? null;
      return held === current ? null : held;
    },
    create: (location: Parameters<typeof createServerWorld>[0]) =>
      createServerWorld(location, crypto.randomUUID(), 'fake-seed', store!.heroId),
  };
}

function travelFake(
  envelope: PlayerEnvelope,
  base: { commandId: string; tileDiffs: never[]; effects: never[]; events: never[] },
  run: Parameters<typeof tickWorld>[0] & ReturnType<typeof fakeFinders>,
) {
  const s = store!;
  const type = envelope.command.type;
  const via = (envelope.command.payload as { via: Parameters<typeof travelWorld>[1] }).via;
  const outcome = type === 'WORLD_TRAVEL' ? travelWorld(run, via) : enterPortalWorld(run);
  if (!outcome.ok) {
    return {
      ...base,
      events: outcome.events,
      effects: outcome.effects,
      result: 'rejected' as const,
      code: outcome.code,
      hero: null,
      aggregates: snapshot().aggregates,
    };
  }
  const { origin, destination, replaced, touched } = outcome;
  for (const [mapId, held] of storedWorlds) {
    if (held.locationKey === origin.locationKey) storedWorlds.delete(mapId);
  }
  storedWorlds.set((replaced ?? origin).mapId, replaced ?? origin);
  storedWorlds.set(destination.mapId, destination);
  for (const other of touched) storedWorlds.set(other.mapId, other);
  world = destination;
  s.progress = { revision: s.progress.revision + 1, state: outcome.progress };
  if (outcome.inventory !== s.inventory.state) {
    s.inventory = { revision: s.inventory.revision + 1, state: outcome.inventory };
  }
  return {
    ...base,
    events: outcome.events,
    effects: outcome.effects,
    result: 'applied' as const,
    hero: null,
    touched: [...(replaced ? [] : [origin]), ...touched].map((other) => ({
      locationKey: other.locationKey,
      world: serializeWorld(other),
    })),
    travel: {
      locationKey: destination.locationKey,
      world: serializeWorld(destination),
      refreshed: replaced
        ? { locationKey: replaced.locationKey, world: serializeWorld(replaced) }
        : null,
    },
    aggregates: snapshot().aggregates,
  };
}

function battleFake(
  envelope: PlayerEnvelope,
  base: { commandId: string; tileDiffs: never[]; effects: never[]; events: never[] },
  run: Parameters<typeof tickWorld>[0] & ReturnType<typeof fakeFinders>,
) {
  const s = store!;
  const payload = envelope.command.payload as Parameters<typeof battleWorld>[1];
  const outcome = battleWorld(run, payload);
  if (!outcome.ok) {
    return {
      ...base,
      events: outcome.events,
      result: 'rejected' as const,
      code: outcome.code,
      hero: null,
      aggregates: snapshot().aggregates,
    };
  }
  let nextWorld = outcome.world;
  const respawn = outcome.respawn;
  let travel: { locationKey: string; world: unknown; refreshed: unknown } | undefined;
  let touched: { locationKey: string; world: unknown }[] = [];
  if (respawn) {
    const { origin, destination, replaced } = respawn;
    for (const [mapId, held] of storedWorlds) {
      if (held.locationKey === origin.locationKey) storedWorlds.delete(mapId);
    }
    storedWorlds.set((replaced ?? origin).mapId, replaced ?? origin);
    storedWorlds.set(destination.mapId, destination);
    for (const other of respawn.touched) storedWorlds.set(other.mapId, other);
    nextWorld = destination;
    travel = {
      locationKey: destination.locationKey,
      world: serializeWorld(destination),
      refreshed: replaced
        ? { locationKey: replaced.locationKey, world: serializeWorld(replaced) }
        : null,
    };
    touched = respawn.touched.map((other) => ({
      locationKey: other.locationKey,
      world: serializeWorld(other),
    }));
  } else {
    storedWorlds.set(outcome.world.mapId, outcome.world);
  }
  world = nextWorld;
  s.progress = { revision: s.progress.revision + 1, state: respawn?.progress ?? outcome.progress };
  const inventory = respawn?.inventory ?? outcome.inventory;
  if (inventory !== s.inventory.state) {
    s.inventory = { revision: s.inventory.revision + 1, state: inventory };
  }
  return {
    ...base,
    events: outcome.events,
    tileDiffs: outcome.tileDiffs,
    steps: outcome.steps,
    serverNowMs: outcome.serverNowMs,
    engagement: outcome.world.engagement,
    ...(outcome.rejected ? { code: outcome.rejected } : {}),
    ...(travel ? { travel, touched } : {}),
    result: 'applied' as const,
    hero: null,
    aggregates: snapshot().aggregates,
  };
}

export function fakeWorldSnapshot() {
  const held = world?.battle ?? null;
  return {
    battleView: held ? projectBattleForViewer(held, 'heroes') : null,
    serverNowMs: Date.now(),
  };
}

export function fakeEngageSquad(at: { columnIndex: number; rowIndex: number }) {
  const held = world!;
  const tile = held.map.tiles.find(
    (t) => t.coordinates.columnIndex === at.columnIndex && t.coordinates.rowIndex === at.rowIndex,
  )!;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETON_PACK, tile.coordinates);
  held.engagement = {
    squadId: `${at.columnIndex}:${at.rowIndex}:skeleton-pack`,
    ambush: false,
    heroAt: { ...held.heroCoordinates! },
    heroIds: [store!.heroId],
    startItems: {},
  };
  return held.engagement;
}

export function fakeEndBattle(outcome: 'victory' | 'defeat') {
  const battle = world!.battle!;
  const loser = outcome === 'victory' ? 'enemies' : 'heroes';
  for (const creature of battle.creatures) if (creature.side === loser) creature.hp = 0;
  battle.outcome = outcome;
  battle.phase = 'ended';
}
