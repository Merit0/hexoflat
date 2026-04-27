<template>
  <div
      v-for="marker in markers"
      :key="marker.key"
      class="combat-marker"
      :class="`owner-${marker.owner}`"
      :style="marker.style"
  >
    🛡
  </div>
</template>

<script setup lang="ts">
defineProps<{
  markers: Array<{ key: string; owner: "hero" | "enemy"; style: Record<string, string> }>;
}>();
</script>

<style scoped>
.combat-marker {
  position: absolute;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -14px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  z-index: 116;
  pointer-events: none;
  font-size: 18px;
  background: rgba(14, 18, 26, 0.92);
}

.combat-marker.owner-hero {
  box-shadow: 0 0 0 2px rgba(120, 176, 255, 0.35), 0 0 16px rgba(120, 176, 255, 0.2);
}

.combat-marker.owner-enemy {
  box-shadow: 0 0 0 2px rgba(255, 120, 120, 0.35), 0 0 16px rgba(255, 120, 120, 0.2);
}
</style>
