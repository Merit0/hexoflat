import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { questRefusalText } from '@/composables/quest-messages';
import { refreshQuestBoard, syncQuestBoard } from '@/services/quests/quest-commands';
import { isRecoveredRefusal } from '@/services/world/held-map';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useQuestStore } from '@/stores/quest-store';

export function useQuestBoardSession(visible: Readonly<Ref<boolean>>) {
  const { t } = useI18n();
  const store = useQuestStore();
  const tool = useHeroToolStore();
  const syncing = ref(false);
  const refreshing = ref(false);
  const busy = computed(() => syncing.value || refreshing.value);
  const quote = computed(() => {
    if (!store.board) return null;
    const { dayId, refreshPrice } = store.board;
    return { dayId, refreshPrice };
  });
  const day = computed(() => quote.value?.dayId);
  let mounted = true;

  function report(reason: string) {
    if (mounted && visible.value && reason !== 'CONTEXT_CHANGED' && !isRecoveredRefusal(reason)) {
      tool.setActionMessage(questRefusalText(reason));
    }
  }

  async function sync() {
    if (syncing.value) return;
    syncing.value = true;
    try {
      const result = await syncQuestBoard();
      if (!result.ok) report(result.reason);
    } finally {
      syncing.value = false;
    }
  }

  async function refresh() {
    const current = quote.value;
    if (busy.value || !current || !visible.value) return;
    refreshing.value = true;
    try {
      const result = await refreshQuestBoard(current);
      if (!mounted) return;
      if (!result.ok) {
        report(result.reason);
        if (visible.value && ['QUEST_BOARD_STALE', 'REVISION_CONFLICT'].includes(result.reason)) {
          await sync();
        }
        return;
      }
      tool.setActionMessage(t('quest.board.refresh.done'), 'will', current.refreshPrice, 'success');
    } finally {
      refreshing.value = false;
    }
  }

  watch(
    [visible, day],
    ([open, dayId], [wasOpen, previousDay]) => {
      const rolledOver = previousDay !== undefined && dayId !== undefined && dayId !== previousDay;
      if (open && (!wasOpen || rolledOver)) void sync();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    mounted = false;
  });

  return { quote, busy, refresh };
}
