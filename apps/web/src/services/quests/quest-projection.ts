import { shallowRef } from 'vue';
import { emptyQuestLog, type QuestLog } from '@hexoflat/engine/quests/quest-log-state';
import type { QuestOfferBoardProjection } from '@hexoflat/engine/quests/quest-board-projection';

export const questProjection = shallowRef<QuestLog>(emptyQuestLog());
export const questBoardProjection = shallowRef<QuestOfferBoardProjection | null>(null);

export interface QuestProgressProjection {
  quests?: QuestLog;
  questBoard?: QuestOfferBoardProjection | null;
}

export function applyQuestProjection(progress: QuestProgressProjection): void {
  questProjection.value = progress.quests ?? emptyQuestLog();
  questBoardProjection.value = progress.questBoard ?? null;
}

export function resetQuestProjection(): void {
  applyQuestProjection({});
}
