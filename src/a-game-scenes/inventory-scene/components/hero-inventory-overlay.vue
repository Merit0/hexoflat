<template>
  <div class="overlay-backdrop game-root" @click.self="closeInventory()">
    <div class="board">
      <header class="board-top">
        <div class="tabs">
          <button class="tab is-active">Inventory</button>
          <button class="tab is-disabled" disabled>Skills</button>
        </div>
      </header>

      <section class="board-body">
        <inventory-board-grid/>
        <div class="center-layer">
          <token-details-panel v-if="selectedItem" :item="selectedItem"/>
          <hero-equip-board v-else/>
        </div>
      </section>

      <!-- (опційно) нижня панель, поки пусто -->
      <footer class="board-bottom">
        <div class="hint">
          <span v-if="selectedItem">Click token again to close details</span>
          <span v-else>Pick items on map → tokens appear here</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import InventoryBoardGrid from "@/a-game-scenes/inventory-scene/components/inventory-board-grid.vue";
import HeroEquipBoard from "@/a-game-scenes/inventory-scene/components/hero-equip-board.vue";
import TokenDetailsPanel from "@/a-game-scenes/inventory-scene/components/token-details-panel.vue";

import {computed} from "vue";
import {useOverlayStore} from "@/stores/overlay-store";
import {useHeroInventoryStore} from "@/stores/hero-inventory-store";

const overlayStore = useOverlayStore();
const inv = useHeroInventoryStore();

const selectedItem = computed(() => inv.selectedItem);

function closeInventory() {
  inv.clearSelection();
  overlayStore.closeOverlay();
}
</script>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.68);
  display: grid;
  place-items: center;
  z-index: 2000;
}

.board {
  width: min(1240px, 96vw);
  height: min(720px, 92vh);
  border-radius: 18px;
  position: relative;

  background: radial-gradient(1200px 600px at 50% 30%, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.0)),
  linear-gradient(180deg, rgba(20, 22, 28, 0.95), rgba(10, 11, 14, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.70);

  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}

.board-top {
  padding: 14px 14px 0;
  display: grid;
  gap: 10px;
}

.tabs {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr; /* 50 / 50 */
  gap: 8px;

  padding: 8px;
  border-radius: 14px;

  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
}

.tab {
  width: 100%;
  height: 44px;

  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);

  background: rgba(255, 0, 120, 0.14);
  color: rgba(255, 255, 255, 0.90);

  font-weight: 1000;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 13px;
}

.tab.is-active {
  background: rgba(255, 0, 120, 0.30);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.10) inset;
}

.tab.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.board-body {
  position: relative;
  padding: 10px 14px 12px;
}

.center-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none; /* центр не перекриває грід поки */
}

.board-bottom {
  padding: 10px 14px 14px;
  display: flex;
  justify-content: center;
}

.hint {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.70);
  font-weight: 700;
  font-size: 12px;
}
</style>