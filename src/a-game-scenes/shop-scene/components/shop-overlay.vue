<template>
  <div class="globalOverlay" v-if="showShopOverlay">
    <div class="shopOverlay" data-testid="shop-overlay">
      <div class="shopBtn refresh"
           :class="{
          notEnough: !canRefresh,
          }"
           @click="refreshShop"
      ></div>
      <div class="refresh-price-container"
           :class="{
          notEnoughCoinsWarningText: !canRefresh,
          }">
        <div class="priceInfo">
          <div class="priceRow">
            <span class="itemPrice" :class="{
          notEnoughCoinsWarningText: !canRefresh,
          }">{{ refreshPrice }}</span>
            <img class="coinIcon" src="/src/a-game-scenes/home-scene/assets/hero-properties-icons/coin-icon.png"
                 alt="coin-icon"/>
          </div>
        </div>
      </div>
      <div class="shopBtn close" @click="$emit('closeShop')">
      </div>
      <shop-mode-switcher v-model:isBuyMode="isBuyMode"></shop-mode-switcher>
      <shop-slots-grid v-if="isBuyMode"></shop-slots-grid>
      <trade-slots-grid v-else></trade-slots-grid>
    </div>
  </div>
</template>

<script lang="ts">
import ShopSlotsGrid from "@/a-game-scenes/shop-scene/components/shop-slots-grid.vue";
import ShopModeSwitcher from "@/a-game-scenes/shop-scene/components/shop-mode-switcher.vue";
import TradeSlotsGrid from "@/a-game-scenes/shop-scene/components/trade-slots-grid.vue";
import {useShopStore} from "@/stores/shop-store";
import {useHeroStore} from "@/stores/hero-store";

export default {
  name: "shop-overlay",
  components: {TradeSlotsGrid, ShopModeSwitcher, ShopSlotsGrid},
  emits: ["closeShop"],
  props: {
    showShopOverlay: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  data() {
    return {
      isBuyMode: true,
      refreshPrice: 100
    };
  },
  computed: {
    canRefresh(): boolean {
      const heroStore = useHeroStore();
      return heroStore.getHeroCoinsAmount() >= this.refreshPrice;
    }
  },
  watch: {
    showShopOverlay(newVal: boolean) {
      if (newVal) {
        const shopStore = useShopStore();
        shopStore.initShopItems();
      }
    },
  },
  methods: {
    refreshShop() {
      if (!this.canRefresh) {
        console.log('No coins to refresh the shop!')
        return;
      }
      const shopStore = useShopStore();
      const heroStore = useHeroStore();
      heroStore.pay(this.refreshPrice);
      shopStore.refreshShopItems();
    },
  },
};
</script>

<style>
@import "@/a-game-scenes/shop-scene/styles/shop-modal-style.css";
</style>
