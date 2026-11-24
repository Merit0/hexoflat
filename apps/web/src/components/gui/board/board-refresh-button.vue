<template>
  <span class="wrap">
    <button
      type="button"
      class="board-icon-button refresh"
      :disabled="disabled"
      :aria-label="label"
      :data-affordable="affordable"
      :data-testid="testid"
      @click="emit('refresh')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    </button>
    <span
      class="tip"
      :class="{ 'is-short': !affordable, 'is-below': tipBelow }"
      role="tooltip"
      :data-testid="`${testid}-price`"
      :data-price="price"
    >
      <span class="cost">
        <img :src="WILL_ICON" alt="" aria-hidden="true" />
        {{ price }}
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
const WILL_ICON = '/board-assets/will-icon-image.png';

defineProps<{
  price: number;
  affordable: boolean;
  disabled: boolean;
  label: string;
  testid: string;
  tipBelow?: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();
</script>

<style scoped src="./board-icon-button.css"></style>
<style scoped>
.wrap {
  position: relative;
  display: inline-flex;
}
.refresh svg {
  display: block;
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.18s ease;
}
.refresh:not(:disabled):active svg {
  transform: rotate(60deg);
}
.tip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid rgba(227, 194, 122, 0.55);
  border-radius: 6px;
  background: linear-gradient(180deg, #232d38, #10151b);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 8px 18px rgba(0, 0, 0, 0.55);
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translateY(3px);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    visibility 0.12s;
}
.cost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cfe4f8;
  font-family: var(--font-main, serif), serif;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cost img {
  width: 15px;
  height: 15px;
  object-fit: contain;
}
.tip.is-below {
  top: calc(100% + 8px);
  bottom: auto;
}
.tip.is-short .cost {
  color: #ff9d9d;
}
.refresh:hover + .tip,
.refresh:focus-visible + .tip {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}
</style>
