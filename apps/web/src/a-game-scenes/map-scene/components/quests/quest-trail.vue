<template>
  <div class="trail" :data-testid="testid" :data-count="numbers.length">
    <span class="label">{{ t('quest.run.trail') }}</span>
    <ol v-if="numbers.length" class="steps">
      <li
        v-for="(n, i) in numbers"
        :key="i"
        class="step"
        :class="{
          last: i === numbers.length - 1,
          'is-correct': answerReview?.[i] === true,
          'is-wrong': answerReview?.[i] === false,
        }"
        data-testid="quest-trail-chip"
      >
        {{ n }}
      </li>
    </ol>
    <span v-else class="empty" data-testid="quest-trail-empty">—</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ numbers: readonly number[]; answerReview?: readonly boolean[]; testid?: string }>();
const { t } = useI18n();
</script>

<style scoped>
.trail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b9a982;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.step {
  position: relative;
  min-width: 2rem;
  padding: 3px 8px;
  border: 1px solid #5a4a30;
  border-radius: 6px;
  background: rgba(255, 233, 138, 0.06);
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.step:not(:last-child)::after {
  content: '›';
  position: absolute;
  right: -11px;
  top: 50%;
  transform: translateY(-52%);
  color: #8a7a55;
  pointer-events: none;
}
.step.last {
  border-color: #ffe98a;
  background: rgba(255, 233, 138, 0.18);
  color: #ffe98a;
  font-weight: 700;
}
.empty {
  color: #8a7a55;
}
.step.is-correct {
  color: #8fcb9a;
  border-color: #8fcb9a;
}
.step.is-wrong {
  color: #ff9d8a;
  border-color: #ff9d8a;
}
</style>
