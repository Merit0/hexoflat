<template>
  <div class="globalOverlay">
    <div class="graveContent">
      <button class="closeGraveInventoryBtn" @click="closeGraveInventory">x</button>
      <div class="graveItemsContainer">
        <div class="graveInventoryGrid">
          <grave-treasure-slot
              v-for="(slot, index) in graveStore.graveSlots"
              :key="index"
              :lootItem="slot"
          />
        </div>
      </div>
      <div class="skeletonImageContainer">
        <div class="deadSkeletonImage"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, watch, computed} from 'vue';
import {useOverlayStore} from '@/stores/overlay-store';
import {useGraveStore} from "@/stores/grave-store";
import GraveTreasureSlot from "@/a-game-scenes/battlefield-scene/grave/components/grave-treasure-slot.vue";

export default defineComponent({
  name: 'grave-treasure-inventory-overlay',
  components: {GraveTreasureSlot},
  setup() {
    const graveStore = useGraveStore();
    const overlayStore = useOverlayStore();

    const isGraveEmpty = computed(() => {
      return graveStore.graveInventoryItems.every(item => !item || !item.name);
    });

    const closeGraveInventory = () => {
      overlayStore.closeOverlay('grave-inventory');
      graveStore.resetGrave();
    };

    watch(isGraveEmpty, (empty) => {
      if (overlayStore.isOverlay('grave-inventory') && empty) {
        closeGraveInventory();
      }
    });

    return {
      graveStore,
      closeGraveInventory,
    };
  }
});
</script>

<style>
.graveContent {
  position: relative;
  width: 26vw;
  height: 70vh;
  border-radius: 1vw;
  margin: auto;
  background: linear-gradient(135deg, #2f3639, #2d221f);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 1vw;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.1);
  max-height: 90vh;
}

.graveContent::before {
  content: "";
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: 1vw;
  pointer-events: none;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.02) 70%, transparent 100%);
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.1);
}

.graveItemsContainer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
}

.graveInventoryGrid {
  margin-top: 2vw;
  display: grid;
  grid-template-columns: repeat(3, 12vh);
  grid-template-rows: repeat(3, 12vh);
}

.skeletonImageContainer {
  margin-top: 2rem;
  width: 30vw;
  height: 35vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.deadSkeletonImage {
  width: 130%;
  height: 130%;
  background-image: url("/src/a-game-scenes/battlefield-scene/grave/assets/dead-skeleton-image.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.closeGraveInventoryBtn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2vw;
  height: 2vw;
  border-radius: 50%;
  background: radial-gradient(circle at top left, #5c3a2e, #2d221f);
  border: 2px solid rgba(255, 255, 255, 0.1);
  color: #ff9f9f;
  font-weight: bold;
  font-size: 1.5vw;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(255, 255, 255, 0.1),
  inset 0 0 5px rgba(255, 255, 255, 0.05),
  0 0 15px rgba(0, 0, 0, 0.6);
  transition: all 0.3s ease;
  z-index: 10;
}

.closeGraveInventoryBtn:hover {
  background: radial-gradient(circle at top left, #7e3a3a, #3a2727);
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.15),
  inset 0 0 8px rgba(255, 255, 255, 0.1),
  0 0 20px rgba(255, 255, 255, 0.05);
}
</style>
