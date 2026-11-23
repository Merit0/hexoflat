import { computed } from 'vue';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { QUEST_SLOTS } from '@hexoflat/engine/quests/quest-definition';
import { slotSurcharge } from '@hexoflat/engine/quests/quest-log';
import { walletCoins } from '@hexoflat/engine/trade/trader-view';
import { currentInventory } from '@/services/trade/trade-commands';
import {
  capQuests,
  categoryOf,
  spritePathOf,
  reasonOf,
  type QuestCategory,
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

export function useQuestBoardView() {
  const { cards, tracked } = useQuestView();
  const store = useQuestStore();
  const hero = useHeroStore();

  const rows = computed<QuestRowView[]>(() => {
    const progressOf = new Map(tracked.value.map((entry) => [entry.quest.id, entry]));
    const slotsFull = store.activeCount >= QUEST_SLOTS.max;
    const surcharge = slotSurcharge(store.activeCount) ?? 0;
    return capQuests(
      cards.value.map((card) => {
        const entry = progressOf.get(card.quest.id);
        const template = ALL_QUESTS[card.quest.templateId];
        const category = template ? categoryOf(template) : card.seeker ? 'exp' : 'gather';
        return {
          ...card,
          category,
          sprite: spritePathOf(card.quest.templateId, category),
          timesDone: store.log.done[card.quest.templateId] ?? 0,
          progress: entry?.progress ?? 0,
          ready: entry?.ready ?? false,
          entry: card.quest.accept.kind === 'will' ? card.quest.accept.amount : 0,
          surcharge,
          slotNumber: store.activeCount + 1,
          reason: reasonOf({ state: card.state, slotsFull, willShort: card.willShort }),
          taken: card.state === 'taken',
        };
      }),
    );
  });

  const active = computed(() => rows.value.filter((row) => row.taken));
  const available = computed(() => rows.value.filter((row) => row.state === 'open'));
  return {
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
