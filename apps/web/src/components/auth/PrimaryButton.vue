<template>
  <button
    class="primary"
    :class="{ 'primary--ready': ready, 'primary--bare': !ready && idleShadow === 'none' }"
    type="submit"
    :data-testid="testid"
    :disabled="loading"
  >
    <template v-if="loading">
      <svg
        class="pow-spin primary__spinner"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#101418"
        stroke-width="2.4"
        stroke-linecap="round"
      >
        <path d="M12 3a9 9 0 1 1-9 9" />
      </svg>
      {{ loadingText }}
    </template>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    testid: string;
    loading?: boolean;
    loadingText: string;
    ready?: boolean;
    idleShadow?: 'soft' | 'none';
  }>(),
  { idleShadow: 'soft' },
);
</script>

<style scoped>
.primary {
  height: 58px;
  border: 0;
  border-radius: var(--pow-radius-btn);
  background: var(--pow-accent);
  color: var(--pow-accent-ink);
  font:
    700 18px Inter,
    sans-serif;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(139, 162, 184, 0.2);
  transition:
    filter 0.15s,
    transform 0.1s,
    box-shadow 0.25s;
}
.primary--ready {
  box-shadow:
    0 0 0 4px rgba(139, 162, 184, 0.18),
    0 10px 30px rgba(139, 162, 184, 0.35);
}
.primary--bare {
  box-shadow: none;
}
.primary:hover {
  filter: brightness(1.1);
}
.primary:active {
  transform: translateY(1px);
}
.primary:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.primary:disabled {
}
.primary__spinner {
  width: 18px;
  height: 18px;
}
</style>
