<template>
  <div
      v-for="cell in cells"
      :key="cell.key"
      class="enemy-vision-cell"
      :style="cell.style"
  />

  <div v-if="inCombat" class="combat-alert-overlay"></div>
</template>

<script setup lang="ts">
defineProps<{
  cells: Array<{ key: string; style: Record<string, string> }>;
  inCombat: boolean;
}>();
</script>

<style scoped>
.enemy-vision-cell {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  clip-path: polygon(
      25% 0%,
      75% 0%,
      100% 50%,
      75% 100%,
      25% 100%,
      0% 50%
  );
  pointer-events: none;
  z-index: 55;
  background:
      radial-gradient(circle at 50% 50%, rgba(255, 92, 92, 0.26), rgba(255, 92, 92, 0.10) 58%, rgba(255, 92, 92, 0.02) 100%);
  box-shadow:
      inset 0 0 0 1px rgba(255, 132, 132, 0.18),
      0 0 18px rgba(120, 0, 0, 0.12);
}

.combat-alert-overlay {
  position: absolute;
  inset: -18px;
  pointer-events: none;
  z-index: 120;
  border: 2px solid rgba(255, 92, 92, 0.82);
  box-shadow:
      inset 0 0 0 1px rgba(255, 160, 160, 0.35),
      inset 0 0 64px rgba(120, 0, 0, 0.18),
      0 0 28px rgba(255, 70, 70, 0.2);
  background:
      radial-gradient(circle at center, rgba(255, 0, 0, 0) 54%, rgba(120, 0, 0, 0.10) 100%);
  animation: combatPulse 1.2s ease-in-out infinite;
}

@keyframes combatPulse {
  0%, 100% {
    opacity: 0.75;
  }

  50% {
    opacity: 1;
  }
}
</style>
