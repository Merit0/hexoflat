<template>
  <div class="static-board-coordinates-overlay" data-testid="static-board-coordinates-overlay">
    <div
      v-for="tile in tiles"
      :key="coordinateKey(tile.coordinates)"
      class="static-board-coordinates-overlay__label"
      :style="labelStyle(tile.coordinates)"
    >
      {{ tile.coordinates.columnIndex }},{{ tile.coordinates.rowIndex }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { calcHexPixelPosition, coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

const props = defineProps<{
  tiles: IHexTile[];
  tileWidth: number;
  tileHeight: number;
}>();

function labelStyle(coordinates: IHexCoordinates) {
  const { x, y } = calcHexPixelPosition({ coordinates }, props.tileWidth, props.tileHeight);
  return { transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)` };
}
</script>

<style scoped>
.static-board-coordinates-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
}

.static-board-coordinates-overlay__label {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: 9px;
  color: #fff;
  text-shadow:
    0 0 3px rgb(0 0 0 / 90%),
    0 0 3px rgb(0 0 0 / 90%);
  pointer-events: none;
}
</style>
