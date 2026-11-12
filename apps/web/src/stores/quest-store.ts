import { defineStore } from 'pinia';
import { computed } from 'vue';
import { questProjection } from '@/services/quests/quest-projection';
import { questRun } from '@/services/quests/quest-run-projection';

export const useQuestStore = defineStore('quest', () => {
  const log = computed(() => questProjection.value);
  const run = computed(() => questRun.value);
  const inRun = computed(() => questRun.value !== null);
  const activeCount = computed(() => log.value.active.length);
  const readyCount = computed(
    () => log.value.active.filter((entry) => entry.state === 'ready').length,
  );
  return { log, run, inRun, activeCount, readyCount };
});
