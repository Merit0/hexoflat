import { ref } from 'vue';
import {
  abandonQuest,
  acceptQuest,
  claimQuest,
  syncQuestBoard,
  type QuestOutcome,
} from '@/services/quests/quest-commands';
import { questRefusalText } from '@/composables/quest-messages';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { isRecoveredRefusal } from '@/services/world/held-map';

const message = ref<string | null>(null);
const status = ref<string | null>(null);
const busy = ref(false);

async function run(action: () => Promise<QuestOutcome>, done?: () => string): Promise<boolean> {
  if (busy.value) return false;
  busy.value = true;
  message.value = null;
  try {
    const outcome = await action();
    if (!outcome.ok) {
      if (outcome.reason === 'CONTEXT_CHANGED' || isRecoveredRefusal(outcome.reason)) return false;
      if (
        ['QUEST_OFFER_EXPIRED', 'QUEST_OFFER_REQUIRED', 'REVISION_CONFLICT'].includes(
          outcome.reason,
        )
      ) {
        useHeroToolStore().setActionMessage(questRefusalText(outcome.reason));
        await syncQuestBoard();
      } else if (outcome.reason === 'QUEST_SLOTS_FULL') {
        useHeroToolStore().setActionMessage(questRefusalText(outcome.reason));
      } else {
        message.value = questRefusalText(outcome.reason);
      }
    } else if (done) {
      status.value = done();
    }
    return outcome.ok;
  } finally {
    busy.value = false;
  }
}

export function useQuestActions() {
  return {
    message,
    status,
    busy,
    accept: (questId: string, done?: () => string) => run(() => acceptQuest(questId), done),
    claim: (questId: string, done?: () => string) => run(() => claimQuest(questId), done),
    abandon: (questId: string, done?: () => string) => run(() => abandonQuest(questId), done),
    clearMessage: () => {
      message.value = null;
      status.value = null;
    },
  };
}
