import {
  AGGREGATES,
  PLAYER_COMMAND_AGGREGATES,
  PLAYER_COMMAND_REVISION,
  PLAYER_COMMAND_SCHEMAS,
  executePlayerCommand,
  isPlayerCommandType,
  type PlayerAggregates,
  type PlayerCommand,
} from '@hexoflat/engine';
import {
  actWorld,
  deserializeWorld,
  stepWorld,
  tickWorld,
  type ServerWorld,
  type WorldClientHint,
} from '@hexoflat/engine';
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

let store: Store | null = null;
let world: ServerWorld | null = null;
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
}

export function snapshot(): HeroSnapshot {
  const s = store!;
  return {
    heroId: s.heroId,
    aggregates: {
      inventory: { revision: s.inventory.revision, state: s.inventory.state },
      progress: { revision: s.progress.revision, state: s.progress.state },
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
    { devGrantAllowed: true, inventory: { stashOpen: true, battleOpen: false } },
  );
  if (!outcome.ok) return respond('rejected', outcome.code, outcome.events);
  const changed: HeroSnapshot['aggregates'] = {};
  if (outcome.changed.inventory) {
    s.inventory = { revision: s.inventory.revision + 1, state: outcome.changed.inventory };
    changed.inventory = { revision: s.inventory.revision, state: s.inventory.state };
  }
  if (outcome.changed.progress) {
    s.progress = { revision: s.progress.revision + 1, state: outcome.changed.progress };
    changed.progress = { revision: s.progress.revision, state: s.progress.state };
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

export function adoptFakeWorld(json: string): { ok: true; aggregates: HeroSnapshot['aggregates'] } {
  const s = store!;
  world = deserializeWorld(JSON.parse(json), 0);
  const next = structuredClone(s.progress.state);
  if (world.heroCoordinates) {
    next.presence = {
      locationKey: world.locationKey,
      mapId: world.mapId,
      coordinates: { ...world.heroCoordinates },
    };
  }
  s.progress = { revision: s.progress.revision + 1, state: next };
  return { ok: true, aggregates: { progress: { revision: s.progress.revision, state: next } } };
}

function handleWorld(envelope: PlayerEnvelope) {
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
  s.progress = { revision: s.progress.revision + 1, state: outcome.progress };
  if (outcome.inventory !== s.inventory.state) {
    s.inventory = { revision: s.inventory.revision + 1, state: outcome.inventory };
  }
  return {
    ...base,
    events: outcome.events,
    tileDiffs: outcome.tileDiffs,
    effects: outcome.effects,
    engagement: outcome.world.engagement,
    result: 'applied' as const,
    hero: null,
    aggregates: snapshot().aggregates,
  };
}
