import { ref } from 'vue';
import {
  abandonQuest,
  acceptQuest,
  claimQuest,
  type QuestOutcome,
} from '@/services/quests/quest-commands';
import { questRefusalText } from '@/composables/quest-messages';

const message = ref<string | null>(null);
const busy = ref(false);

async function run(action: () => Promise<QuestOutcome>): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  message.value = null;
  try {
    const outcome = await action();
    if (!outcome.ok) message.value = questRefusalText(outcome.reason);
  } finally {
    busy.value = false;
  }
}

export function useQuestActions() {
  return {
    message,
    busy,
    accept: (questId: string) => run(() => acceptQuest(questId)),
    claim: (questId: string) => run(() => claimQuest(questId)),
    abandon: (questId: string) => run(() => abandonQuest(questId)),
    clearMessage: () => {
      message.value = null;
    },
  };
}
