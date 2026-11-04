<template>
  <div class="tabs" role="group" :aria-label="t('auth.tabs')">
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
      <svg
        class="tabs__icon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path v-for="d in ICONS[mode]" :key="d" :d="d" />
      </svg>
      <span class="tabs__label">{{ labels[mode] }}</span>
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

const ICONS: Record<AuthMode, string[]> = {
  signin: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 17l5-5-5-5', 'M15 12H4'],
  code: ['M12 2l8.7 5v10L12 22l-8.7-5V7z', 'M12 8l3.5 2v4L12 16l-3.5-2v-4z'],
  new: [
    'M12 3v4M12 17v4M3 12h4M17 12h4',
    'M12 8l1.6 2.4L16 12l-2.4 1.6L12 16l-1.6-2.4L8 12l2.4-1.6z',
  ],
};
</script>

<style scoped>
.tabs {
  display: flex;
  align-items: flex-end;
  gap: 0;
  margin: 0 calc(-1 * var(--pad-x, 0px));
  border-bottom: 1px solid var(--pow-border-field);
}
.tabs__btn {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 56px;
  margin-bottom: -1px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 0;
  background: transparent;
  color: var(--pow-text-muted);
  font:
    600 16px/1.2 Inter,
    sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  transition:
    color 0.2s,
    background 0.2s,
    border-color 0.2s;
}
.tabs__btn:hover {
  color: var(--pow-text-2);
  background: var(--pow-chip);
}
.tabs__btn::before {
  content: '';
  position: absolute;
  left: -1px;
  right: -1px;
  bottom: -1px;
  height: 3px;
  background: var(--pow-accent);
  box-shadow: 0 0 14px rgba(139, 162, 184, 0.6);
  transform: scaleX(0);
  opacity: 0;
  transition:
    transform 0.3s cubic-bezier(0.3, 0.7, 0.2, 1),
    opacity 0.2s;
}
.tabs__btn--active,
.tabs__btn--active:hover {
  color: var(--pow-text-strong);
  background: linear-gradient(0deg, rgba(139, 162, 184, 0.16) 0%, var(--pow-field) 70%);
  border-color: var(--pow-border-field);
}
.tabs__btn--active::before {
  transform: scaleX(1);
  opacity: 1;
}
.tabs__btn--active .tabs__icon {
  color: var(--pow-accent);
  filter: drop-shadow(0 0 6px rgba(139, 162, 184, 0.55));
}
.tabs__btn:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: -2px;
}
.tabs__icon {
  width: 20px;
  height: 20px;
  flex: none;
}
@media (prefers-reduced-motion: reduce) {
  .tabs__btn::before {
    transition: none;
  }
}
@media (max-width: 420px) {
  .tabs__icon {
    display: none;
  }
}
</style>
