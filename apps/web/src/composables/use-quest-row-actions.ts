import { useI18n } from 'vue-i18n';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import type { QuestRowView } from '@/composables/use-quest-board-view';
import { rewardText } from '@/a-game-scenes/map-scene/components/quests/quest-reward-text';

export function useQuestRowActions() {
  const { t } = useI18n();
  const actions = useQuestActions();
  const run = useQuestRunActions();

  const nameOf = (row: QuestRowView) => t(row.quest.nameKey);

  return {
    busy: actions.busy,
    take(row: QuestRowView) {
      if (row.seeker) return run.start(row.quest.id);
      const price = row.price;
      return actions.accept(row.quest.id, () =>
        price > 0
          ? t('quest.board.status.taken', { name: nameOf(row), n: price })
          : t('quest.board.status.takenFree', { name: nameOf(row) }),
      );
    },
    enter: (row: QuestRowView) => run.start(row.quest.id),
    claim: (row: QuestRowView) =>
      actions.claim(row.quest.id, () =>
        t('quest.board.status.claimed', { reward: row.rewards.map(rewardText).join(', ') }),
      ),
    abandon: (row: QuestRowView) =>
      actions.abandon(row.quest.id, () => t('quest.board.status.abandoned', { name: nameOf(row) })),
  };
}
