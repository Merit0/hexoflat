import { axialToOffset } from '@hexoflat/engine/utils/hex-utils';
import type { PlayerSocket, PlayerEnvelope } from '@/services/player/player-socket';
import { PlayerSocketError } from '@/services/player/player-socket';
import { apiClient } from '@/api/client';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { applyQuestRun } from './quest-run-projection';
import { startLootFlights } from '@/services/loot/loot-flight-state';
import { containerOpenedOf, planLootFlights } from '@/services/loot/loot-flight';

export type QuestRunAnswer =
  { ok: true; events: DomainEvent[] } | { ok: false; code: string; events: DomainEvent[] };

export interface QuestTransport {
  socket: PlayerSocket;
  heroId: string;
  progressRevision: number;
  applyProgress(projection: { revision: number; state: unknown } | undefined): void;
  applyInventory(projection: { revision: number; state: unknown } | undefined): void;
  lost(error: unknown): void;
  isCurrent?: () => boolean;
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
    if (transport.isCurrent?.() === false) return { ok: false, code: 'STALE_CONTEXT', events: [] };
    const response = await transport.socket.sendQuest(envelope);
    if (transport.isCurrent?.() === false) return { ok: false, code: 'STALE_CONTEXT', events: [] };
    transport.applyProgress(response.aggregates.progress);
    transport.applyInventory(response.aggregates.inventory);
    const events = response.events as DomainEvent[];
    const opened = response.replayed ? null : containerOpenedOf(events, axialToOffset);
    if (opened) startLootFlights(planLootFlights(opened));
    applyQuestRun(response.quest);
    if (response.replayed) await restoreQuestRun(transport.isCurrent);
    if (response.result === 'applied') return { ok: true, events };
    return { ok: false, code: response.code ?? response.result, events };
  } catch (error) {
    if (transport.isCurrent?.() === false) return { ok: false, code: 'STALE_CONTEXT', events: [] };
    transport.lost(error);
    const code = error instanceof PlayerSocketError ? error.code : 'OFFLINE';
    return { ok: false, code, events: [] };
  }
}

export async function restoreQuestRun(isCurrent: () => boolean = () => true): Promise<void> {
  const answer = await apiClient.get<{ quest: QuestProjection | null }>('/player/quest');
  if (isCurrent()) applyQuestRun(answer?.quest ?? null);
}
