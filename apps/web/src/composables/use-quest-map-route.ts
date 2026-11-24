import { watch } from 'vue';
import router, { ROUTES } from '@/router';
import { questRun, questRunKnown } from '@/services/quests/quest-run-projection';
import { arrivalTarget } from '@/services/world/presence-location';
import { closeKnowledgePanel } from './use-knowledge-panel';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';

export function useQuestMapRoute(fallbackLocation: () => LocationKey) {
  watch(
    [
      () => questRun.value !== null,
      () => questRunKnown.value,
      () => router.currentRoute.value.name,
    ],
    ([active, known, name]) => {
      if (active) {
        void closeKnowledgePanel(false);
        if (name !== ROUTES.QUEST_MAP) void router.replace({ name: ROUTES.QUEST_MAP });
      } else if (known && name === ROUTES.QUEST_MAP) {
        void router.replace({
          name: ROUTES.WORLD,
          params: { locationKey: arrivalTarget() ?? fallbackLocation() },
        });
      }
    },
    { immediate: true },
  );
}
