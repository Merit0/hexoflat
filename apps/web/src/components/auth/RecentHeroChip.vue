<template>
  <button
    class="chip"
    :class="{ 'chip--selected': selected }"
    type="button"
    data-testid="auth-recent-hero"
    :aria-pressed="selected"
    @click="emit('pick')"
  >
    <svg class="chip__avatar" aria-hidden="true" viewBox="0 0 32 32">
      <polygon
        points="16,1 29,8.5 29,23.5 16,31 3,23.5 3,8.5"
        fill="#2c2c2f"
        :stroke="hero.color"
        stroke-width="1.4"
      />
      <text
        x="16"
        y="21"
        text-anchor="middle"
        font-family="Cinzel, serif"
        font-size="13"
        font-weight="700"
        fill="#e8e8ea"
      >
        {{ initial }}
      </text>
    </svg>
    {{ hero.name }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RecentHero } from '@/features/auth/composables/use-recent-heroes';

const props = defineProps<{ hero: RecentHero; selected: boolean }>();
const emit = defineEmits<{ pick: [] }>();

const initial = computed(() => (props.hero.name.trim()[0] ?? '?').toUpperCase());
</script>

<style scoped>
.chip {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px 0 6px;
  border-radius: var(--pow-radius-chip);
  border: 1px solid var(--pow-border);
  background: var(--pow-chip);
  color: var(--pow-text);
  font:
    500 16px Inter,
    sans-serif;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.chip--selected {
  border-color: var(--pow-accent);
}
.chip:hover {
  background: var(--pow-chip-hover);
}
.chip:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.chip__avatar {
  width: 32px;
  height: 32px;
}
</style>
