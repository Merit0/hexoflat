import { computed } from 'vue';
import { BOARD_QUESTS } from '@hexoflat/engine/quests/quests.content';
import { describeQuest } from '@hexoflat/engine/quests/objectives';
import { questBoardState, slotSurcharge } from '@hexoflat/engine/quests/quest-log';
import {
  QUEST_SLOTS,
  type QuestDefinition,
  type Reward,
} from '@hexoflat/engine/quests/quest-definition';
import { useQuestStore } from '@/stores/quest-store';

export interface QuestCardView {
  quest: QuestDefinition;
  state: 'open' | 'locked' | 'taken' | 'finished';
  price: number;
  itemCost: { key: string; amount: number } | null;
  target: number;
  unitKey: string;
  rewards: readonly Reward[];
  repeat: QuestDefinition['repeat'];
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

  const slotLine = computed(() => ({
    used: store.activeCount,
    max: QUEST_SLOTS.max,
    nextSurcharge: slotSurcharge(store.activeCount),
  }));

  const cards = computed<QuestCardView[]>(() =>
    BOARD_QUESTS.map((quest) => {
      const described = describeQuest(quest);
      const surcharge = slotSurcharge(store.activeCount) ?? 0;
      const base = quest.accept.kind === 'will' ? quest.accept.amount : 0;
      return {
        quest,
        state: questBoardState(store.log, quest),
        price: base + surcharge,
        itemCost:
          quest.accept.kind === 'item'
            ? { key: quest.accept.itemKey, amount: quest.accept.amount }
            : null,
        target: described.target,
        unitKey: described.unitKey,
        rewards: quest.rewards,
        repeat: quest.repeat,
      };
    }).filter((card) => card.state !== 'finished'),
  );

  const tracked = computed<TrackedQuestView[]>(() =>
    store.log.active.flatMap((entry) => {
      const quest = BOARD_QUESTS.find((candidate) => candidate.id === entry.questId);
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
