<template>
  <div
      class="overlay-root"
      :class="{ 'overlay-root--active': overlay.stack.length > 0 }"
  >
    <component
        v-for="(entry, i) in overlay.stack"
        :key="entry.name + i"
        :is="registry[entry.name]"
        :data="entry.data"
        :style="{ zIndex: 2000 + i }"
        @close="overlay.closeOverlay(entry.name)"
    />
  </div>
</template>

<script setup lang="ts">
import { useOverlayStore } from "@/stores/overlay-store";
import HeroInventoryOverlay from "@/a-game-scenes/inventory-scene/components/hero-inventory-overlay.vue";
import HexTileDetailsOverlay from "@/components/overlays/hex-tile-details-overlay.vue";

const overlay = useOverlayStore();

const registry = {
  "hero-inventory": HeroInventoryOverlay,
  "hex-tile-details": HexTileDetailsOverlay,
} as const;
</script>

<style scoped>
.overlay-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;

  /* коли нема оверлеїв — хост невидимий і не ловить кліки */
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: none;
}

/* коли є оверлеї — вмикаємо фон і кліки */
.overlay-root--active {
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  pointer-events: auto;
}

/* коли хочеш кастомну анімацію для появи оверлейних панелей:
.overlay-root > * {
  animation: fadeIn 0.25s ease both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
*/
</style>
