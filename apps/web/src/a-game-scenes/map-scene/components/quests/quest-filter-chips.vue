<template>
  <div
    class="filters"
    data-testid="quest-filters"
    role="group"
    :aria-label="t('quest.board.filter.label')"
  >
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
.filters {
  position: relative;
  isolation: isolate;
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 10px 14px;
  background: linear-gradient(180deg, #5a6d7e, #202b36);
  clip-path: polygon(
    12px 0,
    calc(100% - 12px) 0,
    100% 12px,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    12px 100%,
    0 calc(100% - 12px),
    0 12px
  );
}
.filters::before {
  position: absolute;
  inset: 2px;
  z-index: -1;
  content: '';
  background: linear-gradient(180deg, #1a2029, #10151c);
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    10px 100%,
    0 calc(100% - 10px),
    0 10px
  );
}
.chip {
  min-height: 32px;
  height: 32px;
  padding: 0 14px;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(243, 232, 210, 0.75);
  background: linear-gradient(180deg, #2a3744, #1c252e);
  border: 1px solid #46586a;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
}
.chip b {
  margin-left: 4px;
  font-weight: 700;
  color: #f5c26b;
}
.chip:hover {
  border-color: #7a8da0;
}
.chip:focus-visible {
  outline: 2px solid #f5c26b;
  outline-offset: 2px;
}
.chip[aria-pressed='true'] {
  color: #2a1e0a;
  background: linear-gradient(180deg, #f5c26b, #b5863a);
  border-color: #ffe7a3;
}
.chip[aria-pressed='true'] b {
  color: #2a1e0a;
}
</style>
