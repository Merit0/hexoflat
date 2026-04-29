<template>
  <div
      v-for="(segment, index) in segments"
      :key="`preview-segment-${index}`"
      class="move-preview-segment"
      :class="{ 'is-reachable': reachable, 'is-unreachable': !reachable }"
      :style="segment.style"
  />

  <div
      v-if="markerStyle"
      class="move-preview-marker"
      :class="[
        { 'is-reachable': reachable, 'is-unreachable': !reachable },
        markerKind ? `kind-${markerKind}` : ''
      ]"
      :style="markerStyle"
  >
    <span v-if="markerKind === 'defend'" class="move-preview-marker__icon">🛡</span>
    <span v-else class="move-preview-marker__cost">{{ stepCost }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  segments: Array<{ style: Record<string, string> }>;
  markerStyle: Record<string, string> | null;
  reachable: boolean;
  stepCost: number;
  markerKind?: "move" | "defend";
}>();
</script>

<style scoped>
.move-preview-segment {
  position: absolute;
  height: 4px;
  transform-origin: 0 50%;
  border-radius: 999px;
  pointer-events: none;
  z-index: 95;
  box-shadow: 0 0 18px rgba(0, 0, 0, 0.28);
}

.move-preview-segment.is-reachable {
  background: linear-gradient(90deg, rgba(103, 255, 157, 0.25), rgba(121, 255, 180, 0.95));
}

.move-preview-segment.is-unreachable {
  background: linear-gradient(90deg, rgba(255, 108, 108, 0.25), rgba(255, 128, 128, 0.95));
}

.move-preview-marker {
  position: absolute;
  width: 26px;
  height: 26px;
  margin-left: -13px;
  margin-top: -13px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  pointer-events: none;
  z-index: 110;
  backdrop-filter: blur(2px);
}

.move-preview-marker__cost {
  color: rgba(245, 252, 255, 0.98);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.48);
}

.move-preview-marker__icon {
  font-size: 16px;
  line-height: 1;
  filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.48));
}

.move-preview-marker.is-reachable {
  background: rgba(96, 255, 164, 0.16);
  border: 2px solid rgba(132, 255, 184, 0.96);
  box-shadow:
      0 0 0 4px rgba(96, 255, 164, 0.12),
      0 0 24px rgba(96, 255, 164, 0.4);
}

.move-preview-marker.is-unreachable {
  background: rgba(255, 100, 100, 0.14);
  border: 2px solid rgba(255, 126, 126, 0.96);
  box-shadow:
      0 0 0 4px rgba(255, 100, 100, 0.1),
      0 0 24px rgba(255, 100, 100, 0.32);
}

.move-preview-marker.kind-defend {
  background: rgba(92, 160, 255, 0.18);
  border: 2px solid rgba(132, 188, 255, 0.96);
  box-shadow:
      0 0 0 4px rgba(96, 154, 255, 0.12),
      0 0 24px rgba(96, 154, 255, 0.34);
}
</style>
