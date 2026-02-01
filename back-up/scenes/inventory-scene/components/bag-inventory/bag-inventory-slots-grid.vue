<template>
  <div class="bagGridContainer">
    <div class="bagInventoryGrid" data-testid="bag-inventory-slots-grid">
      <BagItemTile v-for="bagItem in bagStore.bagItems" :key="bagItem.id" :lootItem="bagItem"></BagItemTile>
      <div
          v-for="n in allSlotsNumber - bagStore.itemsNumber"
          :key="n"
          class="inventorySlotContainer"
      >
        <div class="inventoryFrameImage"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">

import BagItemTile from "@/a-game-scenes/inventory-scene/components/bag-inventory/bag-item-tile.vue";
import {useHeroStore} from "@stores/hero-store";
import {useBagStore} from "@stores/bag-store";

export default {
  name: "bag-inventory-slots-grid",
  components: {BagItemTile},
  data() {
    const heroStore = useHeroStore();
    const bagStore = useBagStore();
    return {
      heroStore,
      bagStore,
      allSlotsNumber: 25,
    };
  }
}
</script>

<style>
@import "@/a-game-scenes/inventory-scene/styles/inventory-slot.css";
@import "@/a-game-scenes/inventory-scene/styles/bag-inventory-grid-style.css";
</style>