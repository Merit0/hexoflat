<template>
  <div class="chips" role="group" :aria-label="t('quest.board.filter.label')">
    <button
      v-for="item in items"
      :key="item"
      type="button"
      class="chip"
      :class="`f-${item}`"
      :data-testid="`quest-filter-${item}`"
      :aria-pressed="filter === item"
      @click="filter = item"
    >
      {{ t(`quest.board.filter.${item}`) }} <b>{{ counts[item] }}</b>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { QUEST_CATEGORIES, type QuestFilter } from '@/services/quests/quest-board-model';
import { useQuestBoardView } from '@/composables/use-quest-board-view';

const { t } = useI18n();
const { filter, counts } = useQuestBoardView();
const items: QuestFilter[] = ['all', ...QUEST_CATEGORIES];
</script>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.chip {
  min-height: 30px;
  height: 30px;
  padding: 0 12px;
  font-family: var(--q-body);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--q-label);
  background: transparent;
  border: 1px solid var(--q-line);
  border-radius: 15px;
  cursor: pointer;
}
.chip b {
  margin-left: 4px;
  font-weight: 700;
  opacity: 0.8;
}
.chip:focus-visible {
  outline: 2px solid #c9a04e;
  outline-offset: 2px;
}
.chip[aria-pressed='true'] {
  color: #e9c77b;
  background: rgba(201, 160, 78, 0.14);
  border-color: #c9a04e;
}
</style>
