<template>
  <div class="heart" :class="`is-${state}`">
    <img
      v-if="state === 'full'"
      class="heart__layer"
      :src="HEART_FULL_URL"
      alt=""
      data-testid="hero-heart-full"
    />
    <img
      v-else-if="state === 'half'"
      class="heart__layer"
      :src="HEART_HALF_URL"
      alt=""
      data-testid="hero-heart-half"
    />
    <img
      class="heart__layer heart__frame"
      :src="HEART_FRAME_URL"
      alt=""
      data-testid="hero-heart-frame"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const HEART_FRAME_URL = '/board-assets/hero-board/slot-heart-icon.png';
const HEART_FULL_URL = '/board-assets/hero-board/heart-icon.png';
const HEART_HALF_URL = '/board-assets/hero-board/cracker-heart-icon.png';

const props = defineProps<{ fill: number }>();

const state = computed<'full' | 'half' | 'empty'>(() => {
  if (props.fill >= 1) return 'full';
  return props.fill >= 0.5 ? 'half' : 'empty';
});
</script>

<style scoped>
.heart {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}
.heart__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(1.18);
  user-select: none;
  pointer-events: none;
}
.heart__frame {
  z-index: 1;
}
</style>
