import { watch } from 'vue';
import router, { ROUTES } from '@/router';
import { questRun } from '@/services/quests/quest-run-projection';
import { closeKnowledgePanel } from './use-knowledge-panel';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';

/** The URL identifies the experience; the server projection identifies the run. */
export function useQuestMapRoute(origin: () => LocationKey) {
  watch(
    [() => questRun.value !== null, () => router.currentRoute.value.name],
    ([active, name]) => {
      if (active) {
        void closeKnowledgePanel(false);
        if (name !== ROUTES.QUEST_MAP) void router.replace({ name: ROUTES.QUEST_MAP });
      } else if (name === ROUTES.QUEST_MAP) {
        void router.replace({ name: ROUTES.WORLD, params: { locationKey: origin() } });
      }
    },
    { immediate: true },
  );
}
