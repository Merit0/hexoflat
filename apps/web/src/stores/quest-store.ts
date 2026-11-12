import { defineStore } from 'pinia';
import { computed } from 'vue';
import { questProjection } from '@/services/quests/quest-projection';

export const useQuestStore = defineStore('quest', () => {
  const log = computed(() => questProjection.value);
  const activeCount = computed(() => log.value.active.length);
  const readyCount = computed(
    () => log.value.active.filter((entry) => entry.state === 'ready').length,
  );
  return { log, activeCount, readyCount };
});
