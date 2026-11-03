<template>
  <div class="auth-bg" aria-hidden="true">
    <div class="auth-bg__lattice pow-lattice">
      <svg class="auth-bg__layer auth-bg__layer--base">
        <defs>
          <pattern :id="baseId" width="60" height="104" patternUnits="userSpaceOnUse">
            <path :d="LATTICE_PATH" fill="none" stroke="#6F8BA8" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" :fill="`url(#${baseId})`" />
      </svg>
      <svg class="auth-bg__layer auth-bg__layer--spot" :style="spotStyle">
        <defs>
          <pattern :id="spotId" width="60" height="104" patternUnits="userSpaceOnUse">
            <path :d="LATTICE_PATH" fill="none" stroke="#7FB8E6" stroke-width="1.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" :fill="`url(#${spotId})`" />
      </svg>
    </div>
    <div class="auth-bg__glow" :class="`auth-bg__glow--${variant}`" />
    <svg
      v-for="ripple in ripples"
      :key="ripple.id"
      class="auth-bg__ripple"
      viewBox="0 0 120 120"
      :style="{ left: `${ripple.x}px`, top: `${ripple.y}px` }"
    >
      <polygon
        class="pow-ripple"
        points="60,6 107,33 107,87 60,114 13,87 13,33"
        fill="none"
        stroke="#7FB8E6"
        stroke-width="2"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import type { Ripple } from '@/features/auth/composables/use-ripples';

const props = defineProps<{
  variant: 'wide' | 'phone';
  mx: number;
  my: number;
  ripples: Ripple[];
}>();

const LATTICE_PATH = 'M30 0 L60 17.3 L60 52 L30 69.3 L0 52 L0 17.3 Z M30 69.3 L30 104';

const uid = useId();
const baseId = `pow-grid-a-${uid}`;
const spotId = `pow-grid-b-${uid}`;

const spotStyle = computed(() => {
  const mask = `radial-gradient(circle 190px at ${props.mx + 60}px ${props.my + 60}px, #000 0%, rgba(0,0,0,0) 100%)`;
  return { WebkitMaskImage: mask, maskImage: mask };
});
</script>

<style scoped>
.auth-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.auth-bg__lattice {
  position: absolute;
  left: -60px;
  top: -60px;
  width: calc(100% + 120px);
  height: calc(100% + 160px);
  pointer-events: none;
}
.auth-bg__layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.auth-bg__layer--base {
  opacity: 0.16;
}
.auth-bg__layer--spot {
  opacity: 0.85;
}
.auth-bg__glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.auth-bg__glow--wide {
  left: 6%;
  top: 50%;
  width: 640px;
  height: 640px;
  margin-top: -320px;
  background: radial-gradient(circle, rgba(127, 184, 230, 0.16) 0%, rgba(127, 184, 230, 0) 65%);
}
.auth-bg__glow--phone {
  left: 50%;
  top: -40px;
  width: 420px;
  height: 420px;
  margin-left: -210px;
  background: radial-gradient(circle, rgba(127, 184, 230, 0.18) 0%, rgba(127, 184, 230, 0) 65%);
}
.auth-bg__ripple {
  position: absolute;
  width: 120px;
  height: 120px;
  pointer-events: none;
  overflow: visible;
}
</style>
