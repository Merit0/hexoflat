import { computed } from 'vue';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { useQuestStore } from '@/stores/quest-store';
import { questResult } from '@/services/quests/quest-result';
import { buildQuestField } from '@/services/quests/quest-field-model';

export function useQuestRunView() {
  const store = useQuestStore();

  const run = computed(() => {
    const projection = store.run;
    if (!projection) return null;
    const quest = ALL_QUESTS[projection.offerId];
    const objective = quest?.objective.kind === 'expedition' ? quest.objective : null;
    return {
      projection,
      nameKey: quest?.nameKey ?? projection.offerId,
      step: projection.path.length,
      steps: objective?.params.steps ?? projection.path.length,
      stepCost: projection.stepCost,
      backCost: projection.backCost,
      trail: projection.path.map((entry) => entry.number),
      phase: projection.phase,
      canGiveUp: projection.phase === 'walking' || projection.phase === 'ambush',
      lost: projection.phase === 'lost',
    };
  });

  const field = computed(() => {
    const projection = store.run;
    return projection ? buildQuestField(projection) : null;
  });

  const result = computed(() => {
    const value = questResult.value;
    if (!value) return null;
    const quest = ALL_QUESTS[value.questId];
    return { ...value, nameKey: quest?.nameKey ?? value.questId };
  });

  return { run, field, result };
}
