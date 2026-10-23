<template>
  <div class="shield" :class="{ 'is-filled': filled }">
    <img class="shield__layer" :src="SHIELD_URL" alt="" data-testid="hero-shield-image" />
    <span v-if="filled" class="shield__tint" data-testid="hero-shield-tint"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const SHIELD_URL = '/board-assets/hero-board/shield-icon.png';

const props = defineProps<{ fill: number }>();
const filled = computed(() => props.fill >= 1);
</script>

<style scoped>
.shield {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}
.shield__layer,
.shield__tint {
  transform: scale(1.25);
}
.shield__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
  opacity: 0.45;
  filter: brightness(0) drop-shadow(0 0 1px rgba(127, 176, 255, 0.9));
}
.shield.is-filled .shield__layer {
  opacity: 1;
  filter: drop-shadow(0 0 6px rgba(127, 176, 255, 0.55));
}
.shield__tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, #8fbcff, #2c55c4);
  mix-blend-mode: color;
  pointer-events: none;
  -webkit-mask: url('/board-assets/hero-board/shield-icon.png') center / contain no-repeat;
  mask: url('/board-assets/hero-board/shield-icon.png') center / contain no-repeat;
}
</style>
