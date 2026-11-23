import { computed } from 'vue';
import { useQuestStore } from '@/stores/quest-store';
import { questResult } from '@/services/quests/quest-result';
import { legacyQuestCard, questCardRuleParams } from '@/services/quests/quest-card-content';
import { buildQuestField } from '@/services/quests/quest-field-model';

export function useQuestRunView() {
  const store = useQuestStore();

  const run = computed(() => {
    const projection = store.run;
    if (!projection) return null;
    const quest = projection.offer ?? legacyQuestCard(projection.offerId);
    return {
      projection,
      nameKey: quest?.nameKey ?? projection.offerId,
      descKey: quest?.descKey ?? null,
      goalKey: quest?.tableRule ?? null,
      howKey: quest?.howKey ?? null,
      ruleKey: quest ? `quest.${quest.templateId}.rule` : null,
      target: quest?.goal.target ?? 0,
      ruleParams: quest ? questCardRuleParams(quest) : {},
      step: projection.path.length,
      steps: quest?.expedition?.steps ?? projection.path.length,
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
    const quest = value.offer ?? legacyQuestCard(value.questId);
    return { ...value, nameKey: quest?.nameKey ?? value.questId, target: quest?.goal.target };
  });

  return { run, field, result };
}
