<template>
  <div
    class="tabs"
    role="group"
    :aria-label="t('auth.tabs')"
    :style="{ '--n': modes.length, '--i': Math.max(0, modes.indexOf(current)) }"
  >
    <span class="tabs__thumb" aria-hidden="true" />
    <button
      v-for="mode in modes"
      :key="mode"
      class="tabs__btn"
      :class="{ 'tabs__btn--active': mode === current }"
      type="button"
      :data-testid="`auth-mode-${mode}`"
      :aria-pressed="mode === current"
      @click="emit('select', mode)"
    >
      {{ labels[mode] }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AuthMode } from '@/features/auth/logic/auth-flags';

defineProps<{ modes: AuthMode[]; current: AuthMode }>();
const emit = defineEmits<{ select: [mode: AuthMode] }>();

const { t } = useI18n();
const labels = computed<Record<AuthMode, string>>(() => ({
  signin: t('auth.tab.signin'),
  code: t('auth.tab.code'),
  new: t('auth.tab.new'),
}));
</script>

<style scoped>
.tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: var(--pow-field);
  border: 1px solid #222b37;
}
.tabs__thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: calc(4px + var(--i) * ((100% - (4px * var(--n) + 4px)) / var(--n) + 4px));
  width: calc((100% - (4px * var(--n) + 4px)) / var(--n));
  border-radius: 10px;
  background: var(--pow-selected);
  transition: left 0.25s cubic-bezier(0.3, 0.7, 0.2, 1);
}
.tabs__btn {
  position: relative;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--pow-text-muted);
  font:
    600 13px/1.2 Inter,
    sans-serif;
  cursor: pointer;
  transition:
    filter 0.15s,
    transform 0.1s;
}
.tabs__btn--active {
  color: var(--pow-text-strong);
}
.tabs__btn:hover {
  filter: brightness(1.1);
}
.tabs__btn:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .tabs__thumb {
    transition: none;
  }
}
</style>
