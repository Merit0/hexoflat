<template>
  <div
      class="tool-hex-tile"
      :class="toolClass"
      :style="style"
      title="Tool"
  >
    <button class="hide-btn" @click.stop="emit('hide')">
      HIDE
    </button>
    <div v-if="props.actionHint" class="action-chip">{{ props.actionHint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { IHexCoordinates } from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import { calcHexPixelPosition } from "@/utils/tile-utils";

const props = defineProps<{
  coord: IHexCoordinates | null;
  tileWidth: number;
  tool: "hand" | "axe" | null;
  actionHint?: string
}>();

const emit = defineEmits<{
  (e: "hide"): void;
}>();

const style = computed(() => {
  if (!props.coord || !props.tool) {
    return { display: "none" } as Record<string, string>;
  }

  const pseudoTile = { coordinates: props.coord } as any;
  const { x, y } = calcHexPixelPosition(pseudoTile, props.tileWidth);

  return {
    transform: `translate(${x}px, ${y}px)`,
  } as Record<string, string>;
});

const toolClass = computed(() => {
  if (!props.tool) return "";
  return props.tool === "axe" ? "axe" : "hand";
});
</script>

<style scoped>
.tool-hex-tile {
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

  /* плавне “стрибаюче” прилипання */
  transition: transform 140ms ease-out;

  z-index: 120;
  pointer-events: auto;

  box-shadow:
      0 0 0 2px rgba(255,255,255,0.20),
      0 12px 28px rgba(0,0,0,0.55);
}

/* 🟡 HAND */
.tool-hex-tile.hand {
  background: linear-gradient(145deg, #e6c15a, #b8922d);
}

.tool-hex-tile.axe {
  background-image: url("@/assets/tools-assets/axe-tile-image.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.hide-btn {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;

  width: 64px;
  height: 30px;
  border-radius: 10px;

  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(0,0,0,0.55);
  color: #f2e9d3;

  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.12em;

  transition: opacity 120ms ease, transform 120ms ease, background 120ms ease, filter 120ms ease;
}

.tool-hex-tile:hover .hide-btn {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.hide-btn:hover {
  filter: brightness(1.15);
  background: rgba(0,0,0,0.7);
}

.hide-btn:active {
  transform: scale(0.96);
}

.action-chip {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);

  padding: 6px 10px;
  border-radius: 999px;

  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.18);
  color: #f2e9d3;

  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.12em;

  pointer-events: none;
}
</style>