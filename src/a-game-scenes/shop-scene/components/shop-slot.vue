<template>
  <div class="slotContainer">
    <div class="slotBackground" :style="getSlotBackgroundStyle(lootItem.rarity)">
      <div class="slotImage">
        <img :src="lootItem.imgPath" alt="item" class="itemImage"/>
      </div>
      <div class="slotFrame">
        <div class="slotFrameImage"></div>
      </div>
      <div v-if="!inShop" class="soldOut">
        <span class="soldOutText">Sold Out</span>
      </div>
    </div>
    <div class="slotPriceContainer">
      <div v-if="!inShop" class="noInfo"></div>
      <div v-if="inShop" class="priceInfo">
        <div class="priceRow buyBtn" :class="{
      notEnough: !canAfford,
      canAfford: canAfford
    }" @click="handleBuy(lootItem)">
          <span class="itemPrice">{{ lootItem.price }}</span>
          <img class="coinIcon" src="/src/a-game-scenes/home-scene/assets/hero-properties-icons/coin-icon.png" alt="coin-icon"/>
        </div>
      </div>
    </div>
  </div>
  <confirm-purchase-modal
      :show-confirm-purchase-overlay="showConfirmPurchasePopup"
      :operation-name="operationName"
      :lootItem="lootItem"
      @closeModal="closePopup"
      @outOfStock="isPurchased"
  >
  </confirm-purchase-modal>
</template>


<script lang="ts">
import {PropType} from 'vue';
import {LootItemModel} from "@/models/LootItemModel";
import {Rarity} from "@/enums/Rarity";
import ConfirmPurchaseModal from "@/a-game-scenes/shop-scene/components/confirm-pusrchase-overlay.vue";
import {useHeroStore} from "@/stores/hero-store";

export default {
  name: "shop-slot",
  components: {ConfirmPurchaseModal},
  props: {
    lootItem: {
      type: Object as PropType<LootItemModel>,
      required: true
    }
  },
  data() {
    const heroStore = useHeroStore();
    let inShop = (this.lootItem.place === 'shop');
    const operationName = "Buy";
    return {
      showConfirmPurchasePopup: false,
      heroStore,
      inShop,
      operationName
    }
  },
  computed: {
    canAfford(): boolean {
      if (!this.lootItem || typeof this.lootItem.price !== 'number') return false;
      return this.heroStore.getHeroCoinsAmount() >= this.lootItem.price;
    }
  },
  methods: {
    getSlotBackgroundStyle(itemRarity: Rarity) {
      if (itemRarity === Rarity.LEGEND) {
        return {
          background: `radial-gradient(
        circle at center,
        rgba(203, 149, 255, 0.5) 0%,
        rgba(207, 159, 255, 0.3) 40%,
        rgba(164, 71, 255, 0.15) 70%,
        transparent 100%
      )`
        };
      }
      if (itemRarity === Rarity.MYTHIC) {
        return {
          background: `radial-gradient(
        circle at center,
        rgba(185, 50, 100, 0.5) 0%,
        rgba(144, 40, 115, 0.35) 40%,
        rgba(90, 20, 90, 0.2) 70%,
        transparent 100%
      )`
        };
      }
      if (itemRarity === Rarity.RARE) {
        return {
          background: `radial-gradient(
        circle at center,
        rgba(123, 88, 255, 0.6) 0%,
        rgba(98, 62, 219, 0.4) 40%,
        rgba(54, 34, 129, 0.25) 70%,
        transparent 100%
      )`
        };
      } else {
        return {
          background: `radial-gradient(
        circle at center,
        rgba(144, 255, 184, 0.5) 0%,
        rgba(121, 243, 171, 0.3) 40%,
        rgba(0, 193, 93, 0.15) 70%,
        transparent 100%
      )`
        };
      }
    },
    openConfirmPopup() {
      this.showConfirmPurchasePopup = true;
    },
    closePopup() {
      this.showConfirmPurchasePopup = false;
    },
    isPurchased() {
      this.inShop = false;
    },
    handleBuy(lootItem: LootItemModel) {
      if (!this.canAfford) return;
      if (!lootItem) {
        return
      }
      this.openConfirmPopup(lootItem);
    },
  }
}
</script>

<style>
@import '@/a-game-scenes/shop-scene/styles/shop-slot-style.css';
</style>