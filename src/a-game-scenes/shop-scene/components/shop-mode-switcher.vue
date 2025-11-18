<template>
  <div class="switcher">
    <div
        class="switcher-option"
        :class="{ active: isBuyMode }"
        @click="$emit('update:isBuyMode', true)"
    >
      SHOP
    </div>
    <div
        class="switcher-option"
        :class="{ active: !isBuyMode }"
        @click="$emit('update:isBuyMode', false)"
    >
      TRADE
    </div>
    <div
        class="switcher-indicator"
        :style="indicatorStyle"
    ></div>
  </div>
</template>

<script lang="ts">
export default {
  name: "shop-mode-switcher",
  props: {
    isBuyMode: {
      type: Boolean,
      required: true,
    }
  },
  emits: ['update:isBuyMode'],
  computed: {
    indicatorStyle() {
      return {
        transform: this.isBuyMode ? 'translateX(0%)' : 'translateX(100%)',
      };
    },
  },
};
</script>

<style scoped>
@import "@/a-game-scenes/shop-scene/styles/shop-trade-switcher.css";
</style>