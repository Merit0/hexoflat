import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { apiClient } from '@/api/client';
import { sendWorldCommand, type WorldCommandResult } from '@/services/inventory/inventory-sync';
import type { BattleStep } from '@/stores/battle-store';
import { observeServerClock } from './battle-clock';

export type BattleRequest =
  { kind: 'start' | 'run-enemy-turn' | 'close' | 'sync' } | { kind: 'hero'; action: BattleAction };

export interface BattleReply {
  ok: boolean;
  code: string | null;
  steps: BattleStep[];
  events: DomainEvent[];
  closed: boolean;
  result: WorldCommandResult | null;
}

export async function sendBattle(request: BattleRequest): Promise<BattleReply> {
  const result = await sendWorldCommand('WORLD_BATTLE', request);
  const code = result.code ?? null;
  return {
    ok: result.ok && !code,
    code,
    steps: result.steps as unknown as BattleStep[],
    events: result.events,
    closed: result.events.some((event) => event.type === 'BATTLE_CLOSED'),
    result,
  };
}

interface ServerWorldSnapshot {
  battleView?: BattleProjection | null;
  serverNowMs?: number;
}

let restored: BattleProjection | null = null;

export async function loadServerBattleView(): Promise<BattleProjection | null> {
  const sentAt = Date.now();
  try {
    const body = await apiClient.get<ServerWorldSnapshot | null>('/player/world');
    if (typeof body?.serverNowMs === 'number') {
      observeServerClock(body.serverNowMs, sentAt, Date.now());
    }
    restored = body?.battleView ?? null;
  } catch {
    restored = null;
  }
  return restored;
}

export function takeServerBattleView(): BattleProjection | null {
  const taken = restored;
  restored = null;
  return taken;
}
