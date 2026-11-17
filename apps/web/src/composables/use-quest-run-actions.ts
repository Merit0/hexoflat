import { ref } from 'vue';
import {
  giveUpQuest,
  pauseQuest,
  openQuestChest,
  pickUpQuestLoot,
  returnFromQuest,
  startSeekerQuest,
  stepQuest,
  stepQuestBack,
} from '@/services/quests/quest-run-commands';
import { closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import type { QuestOutcome } from '@/services/quests/quest-commands';
import { questRefusalText } from '@/composables/quest-messages';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { questRun } from '@/services/quests/quest-run-projection';
import { isViewingWorldLocation, routeToLocation } from '@/services/world/location-navigator';
import { refetchServedWorld } from '@/services/world/served-world';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import type { FieldClick } from '@/services/quests/quest-field-model';
import { expectArrival, heldLocationKey } from '@/services/world/presence-location';

const message = ref<string | null>(null);

async function leaveQuestField() {
  await closeKnowledgePanel(false);
  const place = heldLocationKey();
  if (!place) return;
  await refetchServedWorld();
  useWorldMapStore().goToLocation(place);
  if (!isViewingWorldLocation(place)) await routeToLocation(place);
}
const busy = ref(false);

async function run(
  action: () => Promise<QuestOutcome>,
  endExit: () => void = () => undefined,
): Promise<boolean> {
  if (busy.value) return false;
  busy.value = true;
  message.value = null;
  try {
    const wasInQuest = questRun.value !== null;
    const outcome = await action();
    if (!outcome.ok) useHeroToolStore().setActionMessage(questRefusalText(outcome.reason));
    if (outcome.ok && wasInQuest && !questRun.value) await leaveQuestField();
    return outcome.ok;
  } finally {
    endExit();
    busy.value = false;
  }
}

function leave(action: () => Promise<QuestOutcome>): Promise<boolean> {
  if (busy.value) return Promise.resolve(false);
  return run(action, expectArrival());
}

export function useQuestRunActions() {
  return {
    message,
    busy,
    start: async (questId: string) => {
      const started = await run(() => startSeekerQuest(questId));
      if (started) await closeKnowledgePanel(false);
      return started;
    },
    giveUp: () => leave(giveUpQuest),
    returnToCamp: () => leave(returnFromQuest),
    pause: () => leave(pauseQuest),
    openChest: () => run(openQuestChest),
    pickUp: (hex: IHexCoordinates) => run(() => pickUpQuestLoot(hex)),
    click: (action: FieldClick) => {
      if (!action) return Promise.resolve(false);
      if (action.kind === 'back') return run(stepQuestBack);
      return run(() => stepQuest(action.hex satisfies IHexCoordinates));
    },
  };
}
