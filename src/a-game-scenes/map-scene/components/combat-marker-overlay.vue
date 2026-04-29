<template>
  <div
      v-for="marker in markers"
      :key="marker.key"
      class="combat-marker"
      :class="[ `owner-${marker.owner}`, `kind-${marker.kind}` ]"
      :style="marker.style"
  >
    {{ marker.kind === "attack-trace" ? "✖" : "🛡" }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  markers: Array<{ key: string; owner: "hero" | "enemy"; kind: "defend" | "attack-trace"; style: Record<string, string> }>;
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

.combat-marker.kind-attack-trace {
  color: rgba(255, 126, 126, 0.95);
  background: rgba(48, 10, 10, 0.94);
  box-shadow: 0 0 0 2px rgba(255, 80, 80, 0.4), 0 0 20px rgba(255, 80, 80, 0.24);
}
</style>
