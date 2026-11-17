import { shallowRef } from 'vue';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';

export const questRun = shallowRef<QuestProjection | null>(null);
export const questRunKnown = shallowRef(false);

export function applyQuestRun(projection: QuestProjection | null): void {
  questRun.value = projection;
  questRunKnown.value = true;
}

export function resetQuestRun(): void {
  questRun.value = null;
  questRunKnown.value = false;
}
