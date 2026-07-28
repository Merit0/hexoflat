<template>
  <div
    class="overlay-root"
    data-testid="overlay-root"
    :class="{ 'overlay-root--active': overlay.stack.length > 0 }"
  >
    <template v-for="(entry, i) in overlay.stack" :key="entry.name + i">
      <component
        v-if="registry[entry.name]"
        :is="registry[entry.name]"
        :data="entry.data"
        :data-testid="`overlay-${entry.name}`"
        :style="{ zIndex: 2000 + i }"
        @close="overlay.closeOverlay(entry.name)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, type Component } from 'vue';
import { useOverlayStore } from '@/stores/overlay-store';
import type { OverlayType } from '@/types/overlay-types';
import HeroInventoryOverlay from '@/a-game-scenes/inventory-scene/components/hero-inventory-overlay.vue';
import HexTileDetailsOverlay from '@/components/overlays/hex-tile-details-overlay.vue';
import SettingsOverlay from '@/components/overlays/settings-overlay.vue';

const overlay = useOverlayStore();

// Не всі OverlayType ще мають реалізований компонент — рендеримо лише готові.
const registry: Partial<Record<OverlayType, Component>> = {
  'hero-inventory': HeroInventoryOverlay,
  'hex-tile-details': HexTileDetailsOverlay,
  settings: SettingsOverlay,
};

// ✅ Escape закриває верхній оверлей у стеку, як і очікує гравець.
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (!overlay.stack.length) return;

  event.preventDefault();
  overlay.closeTop();
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));
</script>

<style scoped>
.overlay-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: none;
}

.overlay-root--active {
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  pointer-events: auto;
}

.overlay-root > * {
  animation: fadeIn 0.25s ease both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
