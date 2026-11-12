<template>
  <svg
    class="category-icon"
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    :data-category="category"
  >
    <template v-if="category === 'gather'">
      <path d="M12 3 6 12h4l-4 6h12l-4-6h4z" />
      <path d="M12 18v3" />
    </template>
    <template v-else-if="category === 'combat'">
      <path d="M5 19 19 5M14 5h5v5" />
      <path d="M7 15l-2 2M9 17l-2 2" />
    </template>
    <template v-else-if="category === 'learn'">
      <path d="M4 5.5C7 4 10 4.5 12 6c2-1.500 5-2 8-.5V18c-3-1.500-6-1-8 .5-2-1.500-5-2-8-.5z" />
      <path d="M12 6v12.500" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8.500" />
      <path d="m15.500 8.500-2 5-5 2 2-5z" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import type { QuestCategory } from '@/services/quests/quest-board-model';

defineProps<{ category: QuestCategory }>();
</script>
