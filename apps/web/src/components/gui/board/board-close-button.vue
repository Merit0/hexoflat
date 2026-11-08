<template>
  <button
    type="button"
    class="close-btn"
    :data-testid="testid"
    :aria-label="label"
    @click="emit('close')"
  >
    ×
  </button>
</template>

<script setup lang="ts">
defineProps<{ testid: string; label: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<style scoped>
.close-btn {
  --diamond-dim: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 0L10 5L5 10L0 5Z' fill='%2320303c'/></svg>");
  --face: linear-gradient(180deg, #3d4d5c, #2a3744);
  --edge: linear-gradient(180deg, #7a8da0, #1b2630 60%, #46586a);
  position: absolute;
  top: 10px;
  right: 10px;
  isolation: isolate;
  width: 50px;
  min-height: 50px;
  height: 50px;
  padding: 0;
  color: #f3e8d2;
  font-family: inherit;
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.03em;
  cursor: pointer;
  border: 0;
  background: var(--edge);
  clip-path: polygon(
    14px 0,
    calc(100% - 14px) 0,
    100% 14px,
    100% calc(100% - 14px),
    calc(100% - 14px) 100%,
    14px 100%,
    0 calc(100% - 14px),
    0 14px
  );
}
.close-btn::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: var(--face);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
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
.close-btn:not(:disabled):hover {
  --face: linear-gradient(180deg, #4a5d6e, #34444f);
}
.close-btn:focus-visible {
  outline: 3px solid #f5c26b;
  outline-offset: 3px;
}
</style>
