<template>
  <div class="bag-content" data-testid="bag-content">
    <div class="bag-title-container">
      <span class="bag-title">Bag</span>
    </div>
    <div class="inventory-title-bar">
      <div class="inventory-counter-stats">
        <div class="item-amount-holder">
          <div class="iconImg coins-icon" label="heroCoins"></div>
          <p class="heroDetailsText">{{ hero.coins }}</p>
        </div>
        <div class="item-amount-holder">
          <div class="gem-icon-img gems-icon" label="heroGems"></div>
          <p class="heroDetailsText">{{ 0 }}</p>
        </div>
      </div>
    </div>
    <bag-inventory-slots-grid></bag-inventory-slots-grid>
    <div class="separator-wooden-plank"></div>
    <div class="right-side-wooden-plank"></div>
  </div>
</template>
<script lang="ts">

import BagInventorySlotsGrid from "@/a-game-scenes/inventory-scene/components/bag-inventory/bag-inventory-slots-grid.vue";
import {useHeroStore} from "@stores/hero-store";

export default {
  name: "hero-bag-inventory",
  components: {
    BagInventorySlotsGrid,
  },
  setup() {
    const heroStore = useHeroStore();
    const hero = heroStore.hero;
    return {hero};
  }
};
</script>

<style scoped>
@import '@/a-game-scenes/home-scene/styles/hero-details-top-bar-style.css';

.bag-content {
  position: absolute;
  align-items: center;
  display: flex;
  flex-direction: column;
  right: 0;
  width: 27vw;
  height: 100%;
  background: #27171b;
  background-size: 100%, 100%;
  z-index: 2;
}

.bag-title-container {
  position: absolute;
  margin-top: 10vh;
  width: 15vh;
  height: 5vh;
  text-align: center;
  align-content: center;
}

.bag-title {
  font-size: 4vh;
  font-weight: 700;
  color: #ffdfb0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6),
  0 0 5px rgba(255, 230, 200, 0.15);

  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: 'Cinzel', serif;
}

.right-side-wooden-plank {
  position: absolute;
  right: 0;
  width: 0.7rem;
  height: 100%;
  background: linear-gradient(
      to left,
      #513139 0%,
      #3a2329 50%,
      #685353 100%
  );
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.1),
  0 0 10px rgba(0, 0, 0, 0.5);
  border: 1px solid #252525;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.separator-wooden-plank {
  position: absolute;
  left: 0;
  width: 0.7rem;
  height: 100%;
  background: linear-gradient(
      to left,
      #685353 0%,
      #3a2329 50%,
      #685353 100%
  );
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.1),
  0 0 10px rgba(0, 0, 0, 0.5);
  border: 1px solid #252525;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.inventory-counter-stats {
  display: flex;
  justify-content: space-between;
  gap: 13vw;
}

.item-amount-holder {
  position: relative;
  background-color: rgb(255, 240, 186);
  border: 2px solid rgb(64, 27, 1);
  border-radius: 5px;
  width: 6vw;
  min-width: 6vw;
  height: auto;
  display: flex;
  flex-direction: row;
}

.inventory-title-bar {
  position: relative;
  top: 15%;
  width: 93%;
  height: 4vh;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.iconImg {
  width: 34%;
  height: 100%;
  background-position: center;
}

.gem-icon-img {
  width: 34%;
  height: 100%;
  background-position: center;
}

.coins-icon {
  background-image: url("/src/a-game-scenes/home-scene/assets/hero-properties-icons/coin-icon.png");
  background-repeat: no-repeat;
  background-size: contain;
}

.gems-icon {
  background-image: url("/src/a-game-scenes/home-scene/assets/hero-properties-icons/gem-icon.png");
  background-repeat: no-repeat;
  background-size: cover;
}
</style>