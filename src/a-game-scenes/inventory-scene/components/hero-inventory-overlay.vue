<template>
  <div class="overlay-backdrop game-root">
    <div class="inventory-overlay-card">
      <header class="overlay-header">
        <h2>Hero Inventory</h2>
        <close-hero-inventory-modal-button @click="closeInventory()"/>
      </header>
      <div class="hex-tools">
        <!-- HAND -->
        <div
            class="hex-tile hand"
            :class="{ selected: selectedTool === 'hand' }"
            @click="selectTool('hand')"
        >
          <span v-if="selectedTool !== 'hand'" class="hex-label">HAND</span>

          <button
              v-else
              class="hex-use-btn"
              @click.stop="useSelectedTool()"
          >
            USE
          </button>
        </div>

        <!-- AXE -->
        <div
            class="hex-tile axe"
            :class="{ selected: selectedTool === 'axe' }"
            @click="selectTool('axe')"
        >
          <span v-if="selectedTool !== 'axe'" class="hex-label"></span>

          <button
              v-else
              class="hex-use-btn"
              @click.stop="useSelectedTool()"
          >
            USE
          </button>
        </div>
      </div>

      <!-- later -->
      <!-- <hero-bag-inventory/> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import CloseHeroInventoryModalButton from "@/components/gui/buttons/close-hero-inventory-modal-button.vue";
import { useOverlayStore } from "@/stores/overlay-store";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { useWorldMapStore } from "@/stores/world-map-store"; // <- підстав свій шлях/назву

type ToolType = "hand" | "axe";

const overlayStore = useOverlayStore();
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();

const selectedTool = ref<ToolType | null>(null);

function closeInventory() {
  selectedTool.value = null;
  overlayStore.closeOverlay();
}

function selectTool(tool: ToolType) {
  selectedTool.value = selectedTool.value === tool ? null : tool;
}

function useSelectedTool() {
  if (!selectedTool.value) return;

  // якщо координати героя у тебе називаються інакше — заміни тут
  heroToolStore.useTool(selectedTool.value, worldMapStore.heroCoordinates);

  selectedTool.value = null;
  overlayStore.closeOverlay();
}
</script>

<style scoped>

.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 2000;
}

.inventory-overlay-card {
  width: min(520px, 92vw);
  background: #0f1115;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 14px;
  color: #8f846c;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.hex-tools {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-top: 18px;
}

/* base hex */
.hex-tile {
  width: 96px;
  height: 96px;
  clip-path: polygon(
      25% 6%,
      75% 6%,
      100% 50%,
      75% 94%,
      25% 94%,
      0% 50%
  );

  position: relative;
  display: grid;
  place-items: center;
  cursor: pointer;
  user-select: none;

  transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      filter 0.15s ease;
}

/* hover */
.hex-tile:hover {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.1);
}

/* active (на майбутнє selected/use) */
.hex-tile:active {
  transform: scale(0.97);
}

/* HAND – жовтий */
.hex-tile.hand {
  background: linear-gradient(145deg, #e6c15a, #b8922d);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15),
  0 10px 25px rgba(230, 193, 90, 0.35);
}

.hex-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(0, 0, 0, 0.75);
  pointer-events: none;
}

.hex-tile.selected {
  filter: brightness(0.85);
  box-shadow:
      0 0 0 2px rgba(255,255,255,0.25),
      0 0 0 6px rgba(255,255,255,0.06),
      0 14px 30px rgba(0,0,0,0.55);
}

/* tools row */
.hex-tools {
  display: flex;
  gap: 26px;
  justify-content: center;
  margin-top: 18px;
}

/* slot (hex + use button) */
.tool-slot {
  display: grid;
  justify-items: center;
  gap: 10px;
}

/* base hex */
.hex-tile {
  width: 96px;
  height: 96px;
  clip-path: polygon(
      25% 6%,
      75% 6%,
      100% 50%,
      75% 94%,
      25% 94%,
      0% 50%
  );

  display: grid;
  place-items: center;
  cursor: pointer;
  user-select: none;

  transition: transform 0.15s ease,
  box-shadow 0.15s ease,
  filter 0.15s ease;
}

.hex-tile:hover {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.1);
}

.hex-tile:active {
  transform: scale(0.97);
}

/* selected ring */
.hex-tile.selected {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25),
  0 0 0 6px rgba(255, 255, 255, 0.06),
  0 14px 30px rgba(0, 0, 0, 0.55);
}

/* HAND – yellow */
.hex-tile.hand {
  background: linear-gradient(145deg, #e6c15a, #b8922d);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15),
  0 10px 25px rgba(230, 193, 90, 0.35);
}

.hex-tile.axe {
  background-image: url("@/assets/tools-assets/axe-tile-image.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.hex-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(0, 0, 0, 0.75);
  pointer-events: none;
}

.hex-use-btn {
  position: absolute;
  inset: 0;
  margin: auto;

  width: 64px;
  height: 32px;

  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(0,0,0,0.55);
  color: #f2e9d3;

  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.12em;

  cursor: pointer;

  transition:
      transform 0.12s ease,
      background 0.12s ease,
      filter 0.12s ease;
}

.hex-use-btn:hover {
  filter: brightness(1.15);
  background: rgba(0,0,0,0.7);
  transform: scale(1.05);
}

.hex-use-btn:active {
  transform: scale(0.95);
}

</style>