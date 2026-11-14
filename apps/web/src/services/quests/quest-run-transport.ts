import type { PlayerSocket, PlayerEnvelope } from '@/services/player/player-socket';
import { PlayerSocketError } from '@/services/player/player-socket';
import { apiClient } from '@/api/client';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { applyQuestRun } from './quest-run-projection';

export type QuestRunAnswer =
  { ok: true; events: DomainEvent[] } | { ok: false; code: string; events: DomainEvent[] };

export interface QuestTransport {
  socket: PlayerSocket;
  heroId: string;
  progressRevision: number;
  applyProgress(projection: { revision: number; state: unknown } | undefined): void;
  lost(error: unknown): void;
}

export async function runQuestCommand(
  transport: QuestTransport,
  type: string,
  payload: Record<string, unknown>,
): Promise<QuestRunAnswer> {
  const envelope: PlayerEnvelope = {
    commandId: crypto.randomUUID(),
    heroId: transport.heroId,
    aggregate: 'progress',
    expectedRevision: transport.progressRevision,
    command: { type, payload: { heroId: transport.heroId, ...payload } },
  };
  try {
    const response = await transport.socket.sendQuest(envelope);
    transport.applyProgress(response.aggregates.progress);
    applyQuestRun(response.quest);
    const events = response.events as DomainEvent[];
    if (response.result === 'applied') return { ok: true, events };
    return { ok: false, code: response.code ?? response.result, events };
  } catch (error) {
    transport.lost(error);
    const code = error instanceof PlayerSocketError ? error.code : 'OFFLINE';
    return { ok: false, code, events: [] };
  }
}

export async function restoreQuestRun(): Promise<void> {
  const answer = await apiClient.get<{ quest: QuestProjection | null }>('/player/quest');
  applyQuestRun(answer?.quest ?? null);
}
