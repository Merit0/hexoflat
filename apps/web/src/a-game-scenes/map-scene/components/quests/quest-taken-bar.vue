<template>
  <div class="taken" data-testid="quest-slots">
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="#f5c26b"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 13l2 2 4-4" />
    </svg>
    <span class="label">{{ t('quest.board.pill.taken') }}</span>
    <span class="value">{{ slots.used }} / {{ slots.max }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useQuestBoardView } from '@/composables/use-quest-board-view';

const { t } = useI18n();
const { slots } = useQuestBoardView();
</script>

<style scoped>
.taken {
  position: relative;
  isolation: isolate;
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
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
.taken::before {
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
.icon {
  flex: none;
}
.label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(243, 232, 210, 0.82);
}
.value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f3e8d2;
  font-variant-numeric: tabular-nums;
}
</style>
