import type { Engagement } from '@hexoflat/engine/squads/engagement';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { TileDiff } from '@hexoflat/engine/world/tile-diff';
import type { WorldEffect } from '@hexoflat/engine/world/server-ports';
import type { WorldCommandResponse } from '@/services/player/player-socket';

export interface WorldCommandResult {
  ok: boolean;
  code?: string;
  tileDiffs: TileDiff[];
  events: DomainEvent[];
  effects: WorldEffect[];
  engagement: Engagement | null;
  travel?: WorldCommandResponse['travel'];
  touched?: WorldCommandResponse['touched'];
  steps: NonNullable<WorldCommandResponse['steps']>;
  serverNowMs: number | null;
  replayed?: boolean;
  mapId?: string;
}

export function refusedWorldCommand(code: string, mapId?: string): WorldCommandResult {
  return {
    ok: false,
    code,
    tileDiffs: [],
    events: [],
    effects: [],
    engagement: null,
    steps: [],
    serverNowMs: null,
    ...(mapId ? { mapId } : {}),
  };
}
