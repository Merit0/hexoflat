import { shallowRef } from 'vue';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';

export const questRun = shallowRef<QuestProjection | null>(null);

export function applyQuestRun(projection: QuestProjection | null): void {
  questRun.value = projection;
}

export function resetQuestRun(): void {
  questRun.value = null;
}
