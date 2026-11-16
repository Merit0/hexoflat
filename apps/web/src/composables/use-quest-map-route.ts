import { watch } from 'vue';
import router, { ROUTES } from '@/router';
import { questRun, questRunKnown } from '@/services/quests/quest-run-projection';
import { closeKnowledgePanel } from './use-knowledge-panel';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';

export function useQuestMapRoute(origin: () => LocationKey) {
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
        void router.replace({ name: ROUTES.WORLD, params: { locationKey: origin() } });
      }
    },
    { immediate: true },
  );
}
