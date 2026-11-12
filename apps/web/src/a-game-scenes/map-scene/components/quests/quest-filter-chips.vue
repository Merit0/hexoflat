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
  gap: 6px;
}
.chip {
  min-height: 32px;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--q-muted);
  background: var(--q-row);
  border: 1px solid var(--q-line-soft);
  border-radius: 16px;
  cursor: pointer;
}
.chip b {
  margin-left: 4px;
  font-weight: 500;
  color: var(--q-label);
}
.chip:focus-visible {
  outline: 2px solid var(--q-gold);
  outline-offset: 2px;
}
.chip[aria-pressed='true'] {
  color: var(--chip-color);
  border-color: var(--chip-color);
}
.f-all {
  --chip-color: #e8d7a8;
}
.f-gather {
  --chip-color: #7fbf8a;
}
.f-combat {
  --chip-color: #e08a74;
}
.f-learn {
  --chip-color: #8db4e8;
}
.f-exp {
  --chip-color: #e6b85c;
}
</style>
