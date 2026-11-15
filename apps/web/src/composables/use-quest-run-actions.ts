import { ref } from 'vue';
import {
  giveUpQuest,
  openQuestChest,
  pickUpQuestLoot,
  returnFromQuest,
  startSeekerQuest,
  stepQuest,
  stepQuestBack,
} from '@/services/quests/quest-run-commands';
import { openKnowledgePanel } from '@/composables/use-knowledge-panel';
import type { QuestOutcome } from '@/services/quests/quest-commands';
import { questRefusalText } from '@/composables/quest-messages';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { FieldClick } from '@/services/quests/quest-field-model';

const message = ref<string | null>(null);
const busy = ref(false);

async function run(action: () => Promise<QuestOutcome>): Promise<boolean> {
  if (busy.value) return false;
  busy.value = true;
  message.value = null;
  try {
    const outcome = await action();
    if (!outcome.ok) message.value = questRefusalText(outcome.reason);
    return outcome.ok;
  } finally {
    busy.value = false;
  }
}

export function useQuestRunActions() {
  return {
    message,
    busy,
    start: async (questId: string) => {
      const started = await run(() => startSeekerQuest(questId));
      if (started) openKnowledgePanel('quests');
      return started;
    },
    giveUp: () => run(giveUpQuest),
    returnToCamp: () => run(returnFromQuest),
    openChest: () => run(openQuestChest),
    pickUp: (hex: IHexCoordinates) => run(() => pickUpQuestLoot(hex)),
    click: (action: FieldClick) => {
      if (!action) return Promise.resolve(false);
      if (action.kind === 'back') return run(stepQuestBack);
      return run(() => stepQuest(action.hex satisfies IHexCoordinates));
    },
  };
}
