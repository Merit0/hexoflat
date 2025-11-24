<template>
  <div class="overlay-backdrop" @click.self="close">
    <div class="overlay-card">
      <header class="overlay-header">
        <h2>Hex Tile Details</h2>
        <button class="close-btn" @click="close">✕</button>
      </header>

      <div v-if="tile" class="content">
        <div class="row"><span class="label">tileKey</span><span>{{ tile.tileKey }}</span></div>
        <div class="row"><span class="label">tileType</span><span>{{ tile.tileType }}</span></div>
        <div class="row"><span class="label">image</span><span>{{ tile.imagePath }}</span></div>
        <div class="row"><span class="label">description</span><span>{{ tile.description }}</span></div>
        <div class="row"><span class="label">imagePath</span><span>{{ tile.imagePath }}</span></div>

        <div class="row">
          <span class="label">coords</span>
          <span>[{{ tile.coordinates.columnIndex }}, {{ tile.coordinates.rowIndex }}]</span>
        </div>

<!--        <div class="row"><span class="label">isBlocked</span><span>{{ tile.isBlocked }}</span></div>-->

        <!-- якщо є інші поля — додай тут -->
      </div>

      <div v-else class="content empty">
        Tile not found
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWorldMapStore } from "@/stores/world-map-store";
import { useOverlayStore } from "@/stores/overlay-store";
import {OverlayPayloads} from "@/types/overlay-types";

const props = defineProps<{
  data: OverlayPayloads["hex-tile-details"];
}>();

const worldMapStore = useWorldMapStore();
const overlayStore = useOverlayStore();

const tile = computed(() => {
  const map = worldMapStore.map;
  if (!map) return null;

  return map.tiles.find(t =>
      t.coordinates.columnIndex === props.data.q &&
      t.coordinates.rowIndex === props.data.r
  ) ?? null;
});

function close() {
  overlayStore.closeOverlay("hex-tile-details");
}
</script>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: grid;
  place-items: center;
  z-index: 2000;
}
.overlay-card {
  width: min(520px, 92vw);
  background: #0f1115;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 14px;
  color: #e6e6e6;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.close-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
}
.content { display: grid; gap: 8px; }
.row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
}
.label { opacity: 0.7; }
.empty { opacity: 0.7; text-align: center; padding: 20px; }
</style>