import { shallowRef } from 'vue';
import { emptyQuestLog, type QuestLog } from '@hexoflat/engine/quests/quest-log-state';

export const questProjection = shallowRef<QuestLog>(emptyQuestLog());

export function applyQuestProjection(progress: { quests?: QuestLog }): void {
  questProjection.value = progress.quests ?? emptyQuestLog();
}

export function resetQuestProjection(): void {
  questProjection.value = emptyQuestLog();
}
