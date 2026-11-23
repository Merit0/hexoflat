import {
  currentPlayerSession,
  ensurePresence,
  sendInventoryCommand,
  sendProgress,
} from '@/services/inventory/inventory-sync';
import { useWorldMapStore } from '@/stores/world-map-store';
import { HERO_ELSEWHERE } from '@hexoflat/engine/world/enter-rule';
import { holdsPlace } from '@/services/world/held-map';
import type { QuestOfferBoardProjection } from '@hexoflat/engine/quests/quest-board-projection';

export type QuestOutcome = { ok: true } | { ok: false; reason: string };

async function atQuestPlace(action: (isCurrent: () => boolean) => Promise<QuestOutcome>) {
  const world = useWorldMapStore();
  const place = world.currentMapId
    ? { locationKey: world.currentLocationKey, mapId: world.currentMapId }
    : null;
  const sameSession = currentPlayerSession();
  if (!sameSession()) return { ok: false, reason: 'OFFLINE' } as const;
  const isCurrent = () => sameSession() && (!place || holdsPlace(world, place));
  if (!(await ensurePresence(place))) return { ok: false, reason: HERO_ELSEWHERE } as const;
  if (!isCurrent()) return { ok: false, reason: 'CONTEXT_CHANGED' } as const;
  return action(isCurrent);
}

function send(type: string, questId: string): Promise<QuestOutcome> {
  return atQuestPlace(async () => {
    const answer = await sendInventoryCommand(type, { questId });
    if (answer.ok) return { ok: true };
    const rejected = answer.events.find((event) => event.type === 'QUEST_REJECTED');
    const payload = rejected?.payload as { reason?: string } | undefined;
    return { ok: false, reason: payload?.reason ?? answer.code ?? 'REJECTED' };
  });
}

export const acceptQuest = (questId: string) => send('QUEST_ACCEPT', questId);
export const abandonQuest = (questId: string) => send('QUEST_ABANDON', questId);
export const claimQuest = (questId: string) => send('QUEST_CLAIM', questId);

export type QuestBoardQuote = Pick<QuestOfferBoardProjection, 'dayId' | 'refreshPrice'>;

export function syncQuestBoard(): Promise<QuestOutcome> {
  return atQuestPlace(async (isCurrent) => {
    const request = () => sendProgress('QUEST_BOARD_SYNC', {}, { withProgressRevision: true });
    let answer = await request();
    if (answer.code === 'REVISION_CONFLICT' && isCurrent()) answer = await request();
    return answer.ok ? { ok: true } : { ok: false, reason: answer.code ?? 'REJECTED' };
  });
}

export function refreshQuestBoard({ dayId, refreshPrice }: QuestBoardQuote): Promise<QuestOutcome> {
  return atQuestPlace(async () => {
    const answer = await sendProgress(
      'QUEST_BOARD_REFRESH',
      { dayId, expectedPrice: refreshPrice },
      { withProgressRevision: true },
    );
    return answer.ok ? { ok: true } : { ok: false, reason: answer.code ?? 'REJECTED' };
  });
}
