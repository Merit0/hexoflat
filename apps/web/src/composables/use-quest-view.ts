import { computed } from 'vue';
import { slotSurcharge } from '@hexoflat/engine/quests/quest-log';
import { legacyQuestCard, type QuestCardContent } from '@/services/quests/quest-card-content';
import { useQuestStore } from '@/stores/quest-store';
import { useHeroStore } from '@/stores/hero-store';

export interface QuestCardView {
  quest: QuestCardContent;
  state: 'open' | 'taken';
  price: number;
  target: number;
  unitKey: string;
  rewards: QuestCardContent['rewards'];
  repeat: QuestCardContent['repeat'];
  seeker: boolean;
  willShort: boolean;
}

export function useQuestView() {
  const store = useQuestStore();
  const hero = useHeroStore();
  const offers = computed(
    () => new Map((store.board?.offers ?? []).map((offer) => [offer.id, offer])),
  );

  const tracked = computed(() =>
    store.log.active.flatMap((entry) => {
      const quest = offers.value.get(entry.questId) ?? legacyQuestCard(entry.questId);
      if (!quest) return [];
      return [
        {
          quest,
          progress: entry.progress,
          target: quest.goal.target,
          unitKey: quest.goal.unitKey,
          ready: entry.state === 'ready',
        },
      ];
    }),
  );

  const cards = computed<QuestCardView[]>(() => {
    const active = new Set(store.log.active.map(({ questId }) => questId));
    const surcharge = slotSurcharge(store.activeCount) ?? 0;
    const quests = [
      ...tracked.value.map(({ quest }) => quest),
      ...[...offers.value.values()].filter(({ id }) => !active.has(id)),
    ];
    return quests.map((quest) => {
      const base = quest.accept.kind === 'will' ? quest.accept.amount : 0;
      const price = base + surcharge;
      return {
        quest,
        state: active.has(quest.id) ? 'taken' : 'open',
        price,
        target: quest.goal.target,
        unitKey: quest.goal.unitKey,
        rewards: quest.rewards,
        repeat: quest.repeat,
        seeker: !!quest.expedition,
        willShort: (hero.knowledge?.current ?? 0) < price,
      };
    });
  });

  return { cards, tracked };
}
