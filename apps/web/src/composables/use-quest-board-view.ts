import { computed, ref } from 'vue';
import { QUEST_SLOTS } from '@hexoflat/engine/quests/quest-definition';
import { slotSurcharge } from '@hexoflat/engine/quests/quest-log';
import { walletCoins } from '@hexoflat/engine/trade/trader-view';
import { currentInventory } from '@/services/trade/trade-commands';
import {
  categoryOf,
  spritePathOf,
  filterCounts,
  matchesFilter,
  reasonOf,
  type QuestCategory,
  type QuestFilter,
  type QuestReason,
} from '@/services/quests/quest-board-model';
import { useHeroStore } from '@/stores/hero-store';
import { useQuestStore } from '@/stores/quest-store';
import { useQuestView, type QuestCardView } from '@/composables/use-quest-view';

export interface QuestRowView extends QuestCardView {
  category: QuestCategory;
  sprite: string;
  timesDone: number;
  progress: number;
  ready: boolean;
  entry: number;
  surcharge: number;
  slotNumber: number;
  reason: QuestReason;
  taken: boolean;
}

const filter = ref<QuestFilter>('all');

export function useQuestBoardView() {
  const { cards, tracked } = useQuestView();
  const store = useQuestStore();
  const hero = useHeroStore();

  const rows = computed<QuestRowView[]>(() => {
    const progressOf = new Map(tracked.value.map((entry) => [entry.quest.id, entry]));
    const slotsFull = store.activeCount >= QUEST_SLOTS.max;
    const surcharge = slotSurcharge(store.activeCount) ?? 0;
    return cards.value
      .filter((card) => card.state !== 'locked')
      .map((card) => {
        const entry = progressOf.get(card.quest.id);
        return {
          ...card,
          category: categoryOf(card.quest),
          sprite: spritePathOf(card.quest),
          timesDone: store.log.done[card.quest.id] ?? 0,
          progress: entry?.progress ?? 0,
          ready: entry?.ready ?? false,
          entry: card.quest.accept.kind === 'will' ? card.quest.accept.amount : 0,
          surcharge,
          slotNumber: store.activeCount + 1,
          reason: reasonOf({ state: card.state, slotsFull, willShort: card.willShort }),
          taken: card.state === 'taken',
        };
      });
  });

  const counts = computed(() => filterCounts(rows.value.map((row) => row.category)));

  const active = computed(() => {
    const order = store.log.active.map((entry) => entry.questId);
    return rows.value
      .filter((row) => row.taken && matchesFilter(row.category, filter.value))
      .sort((a, b) => order.indexOf(a.quest.id) - order.indexOf(b.quest.id));
  });
  const available = computed(() =>
    rows.value.filter((row) => row.state === 'open' && matchesFilter(row.category, filter.value)),
  );
  return {
    filter,
    counts,
    active,
    available,
    rowById: (id: string) => rows.value.find((row) => row.quest.id === id) ?? null,
    will: computed(() => ({
      value: hero.knowledge?.current ?? 0,
      cap: hero.knowledge?.capacity ?? 0,
    })),
    coins: computed(() => walletCoins(currentInventory())),
    slots: computed(() => ({ used: store.activeCount, max: QUEST_SLOTS.max })),
    extraSlotCosts: QUEST_SLOTS.extraCost,
  };
}
