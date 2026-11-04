<template>
  <fieldset class="grades">
    <legend class="grades__legend">{{ t('auth.new.grade') }}</legend>
    <div class="grades__grid">
      <button
        v-for="g in GRADES"
        :key="g"
        class="grades__btn"
        type="button"
        :data-testid="`auth-grade-${g}`"
        :aria-pressed="model === g"
        :style="{
          borderColor: model === g ? GRADE_COLORS[g] : '#2e2e31',
          background: model === g ? '#2b3036' : '#1a1a1c',
        }"
        @click="model = g"
      >
        {{ g }}
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { GRADE_COLORS, GRADES, type Grade } from '@/features/auth/logic/grade-colors';

const model = defineModel<Grade>({ required: true });
const { t } = useI18n();
</script>

<style scoped>
.grades {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.grades__legend {
  padding: 0;
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--pow-text-2);
}
.grades__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.grades__btn {
  min-height: 44px;
  border-radius: var(--pow-radius-chip);
  border: 1px solid var(--pow-border);
  color: var(--pow-text);
  font:
    600 17px Inter,
    sans-serif;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.grades__btn:hover {
  background: var(--pow-chip-hover) !important;
}
.grades__btn:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
</style>
