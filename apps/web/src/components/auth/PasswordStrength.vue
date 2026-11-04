<template>
  <div class="strength" data-testid="auth-strength">
    <div class="strength__segments">
      <span
        v-for="i in 4"
        :key="i"
        class="strength__segment"
        :style="{ background: i <= score ? STRENGTH_COLORS[score] : '#2e2e31' }"
      />
    </div>
    <span class="strength__label" :style="{ color: STRENGTH_COLORS[shown] }">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { STRENGTH_COLORS } from '@/features/auth/logic/password-score';

const props = defineProps<{ score: number; empty: boolean }>();
const { t } = useI18n();

const shown = computed(() => Math.max(props.score, 1));
const labels = computed(() => [
  '',
  t('auth.strength.1'),
  t('auth.strength.2'),
  t('auth.strength.3'),
  t('auth.strength.4'),
]);
const label = computed(() => (props.empty ? '' : labels.value[shown.value]));
</script>

<style scoped>
.strength {
  display: flex;
  align-items: center;
  gap: 10px;
}
.strength__segments {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}
.strength__segment {
  height: 4px;
  border-radius: 2px;
  display: block;
  transition: background 0.2s;
}
.strength__label {
  font-size: 14px;
  font-weight: 600;
  min-width: 64px;
  text-align: right;
}
</style>
