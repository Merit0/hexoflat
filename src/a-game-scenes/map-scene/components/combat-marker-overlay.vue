<template>
  <div
    v-for="marker in markers"
    :key="marker.key"
    class="combat-marker"
    :class="[`owner-${marker.owner}`, `kind-${marker.kind}`]"
    :style="marker.style"
  >
    <div
      v-if="marker.kind === 'defend' && marker.spritePath"
      class="combat-marker__hex"
      :style="{ backgroundImage: `url('${marker.spritePath}')` }"
    />
    <template v-else>
      {{ marker.kind === 'attack-trace' ? '✖' : '🛡' }}
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  markers: Array<{
    key: string;
    owner: 'hero' | 'enemy';
    kind: 'defend' | 'attack-trace';
    style: Record<string, string>;
    spritePath?: string | null;
  }>;
}>();
</script>

<style scoped>
.combat-marker {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  margin-left: calc(var(--hex-tile-width) / -2);
  margin-top: calc(var(--hex-tile-height) / -2);
  display: grid;
  place-items: center;
  pointer-events: none;
  font-size: 18px;
}

.combat-marker.kind-defend {
  z-index: 0;
}

.combat-marker__hex {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.28));
}

.combat-marker.kind-defend {
  background: transparent;
}

.combat-marker.owner-hero:not(.kind-defend) {
  box-shadow:
    0 0 0 2px rgba(120, 176, 255, 0.35),
    0 0 16px rgba(120, 176, 255, 0.2);
}

.combat-marker.owner-enemy:not(.kind-defend) {
  box-shadow:
    0 0 0 2px rgba(255, 120, 120, 0.35),
    0 0 16px rgba(255, 120, 120, 0.2);
}

.combat-marker.kind-attack-trace {
  z-index: 116;
  color: rgba(255, 126, 126, 0.95);
  background: rgba(48, 10, 10, 0.94);
  box-shadow:
    0 0 0 2px rgba(255, 80, 80, 0.4),
    0 0 20px rgba(255, 80, 80, 0.24);
}
</style>
