import { ensurePresence, sendInventoryCommand } from '@/services/inventory/inventory-sync';
import { useWorldMapStore } from '@/stores/world-map-store';
import { HERO_ELSEWHERE } from '@hexoflat/engine/world/enter-rule';

export type QuestOutcome = { ok: true } | { ok: false; reason: string };

function announcePlace(): Promise<boolean> {
  const world = useWorldMapStore();
  if (!world.currentLocationKey || !world.currentMapId) return Promise.resolve(true);
  return ensurePresence({ locationKey: world.currentLocationKey, mapId: world.currentMapId });
}

async function send(type: string, questId: string): Promise<QuestOutcome> {
  if (!(await announcePlace())) return { ok: false, reason: HERO_ELSEWHERE };
  const answer = await sendInventoryCommand(type, { questId });
  if (answer.ok) return { ok: true };
  const rejected = answer.events.find((event) => event.type === 'QUEST_REJECTED');
  const payload = rejected?.payload as { reason?: string } | undefined;
  return { ok: false, reason: payload?.reason ?? answer.code ?? 'REJECTED' };
}

export const acceptQuest = (questId: string) => send('QUEST_ACCEPT', questId);
export const abandonQuest = (questId: string) => send('QUEST_ABANDON', questId);
export const claimQuest = (questId: string) => send('QUEST_CLAIM', questId);
