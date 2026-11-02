<template>
  <b class="will-number" :class="{ 'is-drop': drop > 0, 'is-gain': gainFlash && gained }">
    {{ current }}
  </b>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { useWillChange } from '@/composables/use-will-change';

const props = defineProps<{ current: number; gainFlash?: boolean }>();
const current = toRef(props, 'current');
const { drop, gained } = useWillChange(() => current.value);
</script>

<style scoped>
.will-number {
  position: relative;
  display: inline-block;
  transition:
    color 0.35s ease,
    text-shadow 0.35s ease;
}
.will-number.is-drop {
  color: #ff5a4a;
  text-shadow: 0 0 8px rgba(255, 90, 74, 0.55);
  transition-duration: 0.08s;
}
.will-number.is-gain {
  color: #6dff9c;
  text-shadow: 0 0 8px rgba(109, 255, 156, 0.55);
  transition-duration: 0.08s;
}
</style>
