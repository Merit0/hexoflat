<template>
  <div class="tradeGridContainer">
    <div class="tradeInventoryGrid">
      <div
          v-for="(item, index) in bagStore.bagItems"
          :key="index"
          class="inventorySlotContainer"
          @mouseover="hoveredItem = index"
          @mouseleave="hoveredItem = null"
      >
        <div class="inventoryFrameImage"></div>
        <img :src="item.imgPath" alt="item" class="inventoryItemImage"/>
        <div
            v-if="hoveredItem === index"
            class="sellButton"
            @click="confirmSell(item)"
        ></div>
      </div>
      <div
          v-for="n in allSlotsNumber - bagStore.itemsNumber"
          :key="n"
          class="inventorySlotContainer"
      >
        <div class="inventoryFrameImage"></div>
      </div>
    </div>
  </div>
  <confirm-purchase-modal
      :show-confirm-purchase-overlay="showConfirmModal"
      :operation-name="operationName"
      :lootItem="selectedItem"
      @closeModal="cancelSell"
  >
  </confirm-purchase-modal>
</template>

<script lang="ts">
import {LootItemModel} from "@/models/LootItemModel"
import {useHeroStore} from "@/stores/hero-store";
import {useBagStore} from "@/stores/bag-store";
import ConfirmPurchaseModal from "@/a-game-scenes/shop-scene/components/confirm-pusrchase-overlay.vue";

export default {
  name: "trade-slots-grid",
  components: {ConfirmPurchaseModal},
  data() {
    const heroStore = useHeroStore();
    const bagStore = useBagStore();
    let isBuyMode = true;
    let showConfirmModal = false;
    return {
      heroStore,
      isBuyMode,
      bagStore,
      hoveredItem: null as number | null,
      showConfirmModal,
      operationName: 'Sell',
      selectedItem: null as LootItemModel | null,
      allSlotsNumber: 36,
    };
  },
  methods: {
    confirmSell(item: LootItemModel) {
      this.selectedItem = item;
      this.showConfirmModal = true;
    },
    cancelSell() {
      this.selectedItem = null;
      this.showConfirmModal = false;
    }
  }
}
</script>

<style>
@import "@/a-game-scenes/shop-scene/styles/trade-slots-grid-style.css";
@import "@/a-game-scenes/inventory-scene/styles/inventory-slot.css";
</style>