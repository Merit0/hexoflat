import { computed } from 'vue';
import { BOARD_QUESTS } from '@hexoflat/engine/quests/quests.content';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { SEEKER_QUESTS } from '@hexoflat/engine/quests/seeker-quests';
import { seekerQuestsEnabled } from '@/composables/seeker-flag';
import { describeQuest } from '@hexoflat/engine/quests/objectives';
import { questBoardState, slotSurcharge } from '@hexoflat/engine/quests/quest-log';
import {
  QUEST_SLOTS,
  type QuestDefinition,
  type Reward,
} from '@hexoflat/engine/quests/quest-definition';
import { useQuestStore } from '@/stores/quest-store';
import { useHeroStore } from '@/stores/hero-store';

export interface QuestCardView {
  quest: QuestDefinition;
  state: 'open' | 'locked' | 'taken' | 'finished';
  price: number;
  itemCost: { key: string; amount: number } | null;
  target: number;
  unitKey: string;
  rewards: readonly Reward[];
  repeat: QuestDefinition['repeat'];
  seeker: SeekerChips | null;
  lockedByKey: string | null;
  willShort: boolean;
}

export interface SeekerChips {
  entry: number;
  steps: number;
  stepCost: number;
  backCost: number;
}

export interface TrackedQuestView {
  quest: QuestDefinition;
  progress: number;
  target: number;
  unitKey: string;
  ready: boolean;
}

export function useQuestView() {
  const store = useQuestStore();
  const hero = useHeroStore();
  const listed = () => (seekerQuestsEnabled() ? [...BOARD_QUESTS, ...SEEKER_QUESTS] : BOARD_QUESTS);

  const slotLine = computed(() => ({
    used: store.activeCount,
    max: QUEST_SLOTS.max,
    nextSurcharge: slotSurcharge(store.activeCount),
  }));

  const cards = computed<QuestCardView[]>(() =>
    listed()
      .map((quest) => {
        const described = describeQuest(quest);
        const surcharge = slotSurcharge(store.activeCount) ?? 0;
        const base = quest.accept.kind === 'will' ? quest.accept.amount : 0;
        const price = base + surcharge;
        const objective = quest.objective;
        const required = quest.requires[0];
        return {
          quest,
          state: questBoardState(store.log, quest),
          price,
          seeker:
            objective.kind === 'expedition'
              ? {
                  entry: price,
                  steps: objective.params.steps,
                  stepCost: objective.params.stepCost,
                  backCost: objective.params.stepCost * objective.params.backMultiplier,
                }
              : null,
          lockedByKey: required ? (ALL_QUESTS[required.questId]?.nameKey ?? null) : null,
          willShort: (hero.knowledge?.current ?? 0) < price,
          itemCost:
            quest.accept.kind === 'item'
              ? { key: quest.accept.itemKey, amount: quest.accept.amount }
              : null,
          target: described.target,
          unitKey: described.unitKey,
          rewards: quest.rewards,
          repeat: quest.repeat,
        };
      })
      .filter((card) => card.state !== 'finished'),
  );

  const tracked = computed<TrackedQuestView[]>(() =>
    store.log.active.flatMap((entry) => {
      const quest = ALL_QUESTS[entry.questId];
      if (!quest) return [];
      const described = describeQuest(quest);
      return [
        {
          quest,
          progress: entry.progress,
          target: described.target,
          unitKey: described.unitKey,
          ready: entry.state === 'ready',
        },
      ];
    }),
  );

  return { cards, tracked, slotLine, readyCount: computed(() => store.readyCount) };
}
