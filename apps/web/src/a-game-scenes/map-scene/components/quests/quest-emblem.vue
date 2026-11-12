<template>
  <span class="emblem" aria-hidden="true">
    <span class="plate">
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        :data-icon="icon"
      >
        <template v-if="icon === 'axes'">
          <path d="M6 20 17 6" />
          <path d="M14 4c3 0 5 2 5 5-1.500.500-3.500 0-5-1.500z" />
          <path d="M18 20 7 6" />
        </template>
        <template v-else-if="icon === 'stones'">
          <path d="m3 18 4-7 4 3 3-6 7 10z" />
          <path d="M7 11 9 18M14 8l-1 6" />
        </template>
        <template v-else-if="icon === 'book'">
          <path
            d="M4 5.500C7 4 10 4.500 12 6c2-1.500 5-2 8-.500V18c-3-1.500-6-1-8 .5-2-1.500-5-2-8-.5z"
          />
          <path d="M12 6v12.500" />
        </template>
        <template v-else-if="icon === 'skull'">
          <path d="M5 11a7 7 0 0 1 14 0c0 2-1 3-2 4v3h-3v-2h-4v2H7v-3c-1-1-2-2-2-4z" />
          <circle cx="9.500" cy="11" r="1.300" />
          <circle cx="14.500" cy="11" r="1.300" />
        </template>
        <template v-else-if="icon === 'compass'">
          <circle cx="12" cy="12" r="8.500" />
          <path d="m15.500 8.500-2 5-5 2 2-5z" />
        </template>
        <template v-else>
          <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z" />
          <path d="M5 19 13 11" />
        </template>
      </svg>
    </span>
  </span>
</template>

<script setup lang="ts">
import type { QuestIcon } from '@/services/quests/quest-board-model';

defineProps<{ icon: QuestIcon }>();
</script>

<style scoped>
.emblem {
  display: block;
  width: 46px;
  height: 52px;
  padding: 2px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #a9844a, #5e4523);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.plate {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #dccba4;
  background: radial-gradient(circle at 50% 40%, #2c2a26, #181716);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
</style>
