import { ensurePresence, sendQuestCommand } from '@/services/inventory/inventory-sync';
import { useWorldMapStore } from '@/stores/world-map-store';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { type QuestOutcome } from './quest-commands';
import type { QuestRunAnswer } from './quest-run-transport';
import { captureQuestResult } from './quest-result';

function outcomeOf(answer: QuestRunAnswer): QuestOutcome {
  if (answer.ok) {
    captureQuestResult(answer.events);
    return { ok: true };
  }
  const rejected = answer.events.find((event) => event.type === 'QUEST_REJECTED');
  const payload = rejected?.payload as { reason?: string } | undefined;
  return { ok: false, reason: payload?.reason ?? answer.code };
}

async function announcePlace(): Promise<void> {
  const world = useWorldMapStore();
  if (!world.currentLocationKey || !world.currentMapId) return;
  await ensurePresence({ locationKey: world.currentLocationKey, mapId: world.currentMapId });
}

async function send(type: string, payload: Record<string, unknown> = {}): Promise<QuestOutcome> {
  return outcomeOf(await sendQuestCommand(type, payload));
}

export async function startSeekerQuest(questId: string): Promise<QuestOutcome> {
  await announcePlace();
  return send('QUEST_ENTER', { questId });
}

export const stepQuest = (hex: IHexCoordinates) => send('QUEST_STEP', { hex });
export const stepQuestBack = () => send('QUEST_STEP_BACK');
export const openQuestChest = () => send('QUEST_OPEN_CHEST');
export const returnFromQuest = () => send('QUEST_RETURN');
export const giveUpQuest = () => send('QUEST_GIVE_UP');
export const pickUpQuestLoot = (hex: IHexCoordinates) => send('QUEST_PICKUP', { hex });

export const pauseQuest = () => send('QUEST_PAUSE');
