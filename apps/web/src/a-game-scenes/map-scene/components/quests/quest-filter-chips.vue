<template>
  <div
    class="filters"
    data-testid="quest-filters"
    role="group"
    :aria-label="t('quest.board.filter.label')"
  >
    <quest-tip v-for="item in items" :key="item" :text="filter === item ? null : name(item)">
      <button
        type="button"
        class="chip"
        :class="{ 'is-active': filter === item }"
        :data-testid="`quest-filter-${item}`"
        :aria-pressed="filter === item"
        :aria-label="`${name(item)} ${counts[item]}`"
        @click="filter = item"
      >
        <svg
          class="glyph"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="item === 'all'">
            <rect x="4" y="4" width="6.500" height="6.500" rx="1.500" />
            <rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500" />
            <rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500" />
            <rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500" />
          </template>
          <template v-else-if="item === 'gather'">
            <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z" />
            <path d="M5 19 13 11" />
          </template>
          <template v-else-if="item === 'combat'">
            <path d="M5 11a7 7 0 0 1 14 0c0 2-1 3-2 4v3h-3v-2h-4v2H7v-3c-1-1-2-2-2-4z" />
            <circle cx="9.500" cy="11" r="1.300" />
            <circle cx="14.500" cy="11" r="1.300" />
          </template>
          <template v-else-if="item === 'learn'">
            <path
              d="M4 5.500C7 4 10 4.500 12 6c2-1.500 5-2 8-.500V18c-3-1.500-6-1-8 .5-2-1.500-5-2-8-.5z"
            />
            <path d="M12 6v12.500" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="8.500" />
            <path d="m15.500 8.500-2 5-5 2 2-5z" />
          </template>
        </svg>
        <span v-if="filter === item" class="name">{{ name(item) }}</span>
        <span class="count">{{ counts[item] }}</span>
      </button>
    </quest-tip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { QUEST_CATEGORIES, type QuestFilter } from '@/services/quests/quest-board-model';
import { useQuestBoardView } from '@/composables/use-quest-board-view';
import QuestTip from './quest-tip.vue';

const { t } = useI18n();
const { filter, counts } = useQuestBoardView();
const items: QuestFilter[] = ['all', ...QUEST_CATEGORIES];
const name = (item: QuestFilter) => t(`quest.board.filter.${item}`);
</script>

<style scoped>
.filters {
  position: relative;
  isolation: isolate;
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  box-sizing: border-box;
  padding: 8px 12px;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  height: 36px;
  padding: 0 9px;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgba(243, 232, 210, 0.8);
  background: linear-gradient(180deg, #2a3744, #1c252e);
  border: 1px solid #46586a;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.glyph {
  flex: none;
  color: #b8c4d0;
}
.count {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  box-sizing: border-box;
  font-size: 0.72rem;
  letter-spacing: 0;
  color: #f5c26b;
  background: #0e1319;
  border: 1px solid #33414f;
  border-radius: 10px;
}
.chip:hover {
  border-color: #7a8da0;
}
.chip:focus-visible {
  outline: 2px solid #f5c26b;
  outline-offset: 2px;
}
.chip.is-active {
  color: #2a1e0a;
  background: linear-gradient(180deg, #f5c26b, #b5863a);
  border-color: #ffe7a3;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 0 12px rgba(245, 194, 107, 0.35);
}
.chip.is-active .glyph {
  color: #2a1e0a;
}
.chip.is-active .count {
  color: #ffe98a;
  background: #2a1e0a;
  border-color: #6b4f1c;
}
</style>
