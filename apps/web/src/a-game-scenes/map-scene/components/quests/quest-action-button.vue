<template>
  <span class="shape" :class="[`v-${variant}`, { 'is-disabled': disabled, 'is-compact': compact }]">
    <button
      v-if="variant !== 'counter'"
      type="button"
      class="face"
      :disabled="disabled"
      :data-testid="testid"
      v-bind="$attrs"
    >
      <slot />
    </button>
    <span v-else class="face" :data-testid="testid" v-bind="$attrs"><slot /></span>
  </span>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
withDefaults(
  defineProps<{
    testid: string;
    variant?: 'steel' | 'claim' | 'counter' | 'main';
    disabled?: boolean;
    compact?: boolean;
  }>(),
  { variant: 'steel', disabled: false, compact: false },
);
</script>

<style scoped>
.shape {
  --face: linear-gradient(180deg, #3d4d5c, #2a3744);
  --edge: linear-gradient(180deg, #7a8da0, #1b2630 60%, #46586a);
  --ink: #f3e8d2;
  display: inline-block;
  width: 104px;
  height: 44px;
}
.shape.v-main {
  width: auto;
  min-width: 132px;
  height: 46px;
}
.shape.v-claim {
  --face: linear-gradient(180deg, #e8bc5e, #b5863a);
  --edge: linear-gradient(180deg, #ffe7a3, #8a6420 60%, #c9a04e);
  --ink: #2a1e0a;
}
.shape.v-counter {
  --face: linear-gradient(180deg, #1b2630, #121a21);
  --edge: linear-gradient(180deg, #46586a, #1b2630);
  --ink: #ffe98a;
}
.shape.is-disabled {
  --face: linear-gradient(180deg, #34383d, #26292d);
  --edge: linear-gradient(180deg, #4a4f55, #2a2d31);
  --ink: #a3a8ae;
}
.shape:focus-within {
  filter: drop-shadow(0 0 2px #ffe7a8) drop-shadow(0 0 6px #f5c26b);
}
.face {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  height: 100%;
  padding: 0 14px;
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.03em;
  color: var(--ink);
  background: var(--edge);
  border: 0;
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
  cursor: pointer;
}
.face::before {
  position: absolute;
  inset: 2px;
  z-index: -1;
  content: '';
  background: var(--face);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
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
button.face:not(:disabled):hover {
  --face: linear-gradient(180deg, #4a5d6e, #34444f);
}
.v-claim button.face:not(:disabled):hover {
  --face: linear-gradient(180deg, #f1c96d, #c19240);
}
span.face {
  cursor: default;
}
button.face:disabled {
  cursor: not-allowed;
}

.is-compact.shape {
  width: 80px;
  height: 34px;
}
.is-compact .face {
  padding: 0 10px;
  font-size: 1.1rem;
  background: transparent;
  clip-path: none;
}
.is-compact .face::before {
  inset: 0;
  z-index: -1;
  background: var(--edge);
  box-shadow: none;
  clip-path: path(
    evenodd,
    'M8 0H72L80 8V26L72 34H8L0 26V8Z M8.6 2H71.4L78 8.6V25.4L71.4 32H8.6L2 25.4V8.6Z'
  );
}
.is-compact.v-claim {
  --edge: linear-gradient(180deg, #ffe7a3, #c9a04e);
  --ink: #ffe98a;
}
.is-compact.v-counter {
  --edge: linear-gradient(180deg, #7a8da0, #46586a);
}
.is-compact button.face:not(:disabled):hover::before {
  background: linear-gradient(180deg, #ffe7a3, #f5c26b);
}
</style>
