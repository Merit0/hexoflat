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
    close() {}
  }
  return { PlayerSocket, PlayerSocketError };
}
