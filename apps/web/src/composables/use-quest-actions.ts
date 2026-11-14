import { ref } from 'vue';
import {
  abandonQuest,
  acceptQuest,
  claimQuest,
  type QuestOutcome,
} from '@/services/quests/quest-commands';
import { questRefusalText } from '@/composables/quest-messages';

const message = ref<string | null>(null);
const status = ref<string | null>(null);
const busy = ref(false);

async function run(action: () => Promise<QuestOutcome>, done?: () => string): Promise<boolean> {
  if (busy.value) return false;
  busy.value = true;
  message.value = null;
  try {
    const outcome = await action();
    if (!outcome.ok) message.value = questRefusalText(outcome.reason);
    else if (done) status.value = done();
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
