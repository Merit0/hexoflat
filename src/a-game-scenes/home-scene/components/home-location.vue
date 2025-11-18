<template>
  <title>Camp</title>
  <hero-details-bar :hero="hero"/>
  <section class="campContent">
    <div class="scalableGridWrapper">
      <div class="buildingGrid">
        <div
            v-for="n in numberOfTiles"
            :key="n"
            class="buildingTile tileBackground"
        ></div>
        <div class="buildingTile initBuildingTile tileBackground">
          <div class="icon dressing-room-icon"/>
        </div>
        <div class="buildingTile initBuildingTile tileBackground" @click="openInventory">
          <div class="icon bag-icon"/>
        </div>
        <div class="buildingTile initBuildingTile tileBackground" @click="exitOnMap">
          <div class="icon map-icon"/>
        </div>
      </div>

      <div class="shopPlace" @click="openShop">
        <div class="shopBackground"></div>
      </div>
    </div>
  </section>
  <shop-overlay
      :show-shop-overlay="showShop"
      @closeShop="closeShop"
  />
  <hero-inventory-overlay></hero-inventory-overlay>
  <hero-dressing-room-overlay v-if="overlayStore.isOverlay('hero-dressing-room')"></hero-dressing-room-overlay>
</template>

<script lang="ts">
import {useHeroStore} from '@/stores/HeroStore';
import router from "@/router";
import ShopOverlay from "@/a-game-scenes/shop-scene/components/shop-overlay.vue";
import HeroInventoryOverlay from "@/a-game-scenes/inventory-scene/components/hero-inventory-overlay.vue";
import HeroDetailsBar from "@/a-game-scenes/home-scene/components/hero-details-bar.vue";
import HeroDressingRoomOverlay from "@/components/hero-builder-modal/hero-dressing-room-overlay.vue";
import {useOverlayStore} from "@/stores/overlay-store";

export default {
  name: "camping-page",
  components: {HeroDressingRoomOverlay, HeroDetailsBar, HeroInventoryOverlay, ShopOverlay},
  data() {
    const heroStore = useHeroStore();
    const overlayStore = useOverlayStore();
    return {
      hero: heroStore.hero,
      heroStore,
      overlayStore,
      numberOfTiles: 75,
      showShop: false,
      time: '',
    };
  },
  methods: {
    increaseHealth() {
      let count = 0;
      this.timeHealth = setInterval(() => {
        const hero = this.heroStore.hero;
        if (hero.getHealth() < hero.maxHealth && count < hero.maxHealth) {
          hero.healthIncreaser();
          count++;
        } else {
          clearInterval(this.timeHealth);
        }
      }, 3000);
    },
    restoreEnergy(energyAmount = 1) {
      let count = 0;
      this.timeEnergy = setInterval(() => {
        const hero = this.heroStore.hero;
        if (hero.getCurrentEnergy() < hero.maxEnergy && count < hero.maxEnergy) {
          hero.collectEnergy(energyAmount);
          count++;
        } else {
          clearInterval(this.timeEnergy);
        }
      }, 3000);
    },
    goFight() {
      router.push('/home');
    },
    exitOnMap() {
      // router.push('/forest-entrance');
      router.push('/silesia');
    },
    openInventory() {
      this.heroStore.inventoryShown = true;
    },
    openDressingRoom() {
      this.overlayStore.openOverlay('hero-dressing-room');
    },
    openShop() {
      this.showShop = true;
    },
    closeShop() {
      this.showShop = false;
    },
  },
  mounted() {
    this.increaseHealth();
    this.restoreEnergy();
  },
  unmounted() {
    if (this.timeHealth) {
      clearInterval(this.timeHealth);
    }
    if (this.timeEnergy) {
      clearInterval(this.timeEnergy);
    }
  }
}
;
</script>

<style scoped>
.campContent {
  display: flex;
  flex-direction: column;
  height: 94vh;
  width: 100%;
  background: #1e1e1e;
  justify-content: center;
  align-items: center;
  position: relative;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.buildingGrid {
  position: relative;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(13, 15vh);
  grid-template-rows: repeat(5, 15vh);
  gap: 2px;
  z-index: 1;
}

.buildingTile {
  width: 15vh;
  height: 15vh;
  box-sizing: border-box;
}

.tileBackground {
  background-image: url('/src/a-game-scenes/home-scene/assets/stone-tile-baground.png');
  background-size: cover;
}

.initBuildingTile {
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.initBuildingTile:hover .icon {
  transform: scale(1.04);
  box-shadow: 0 0 10px rgba(255, 200, 0, 0.6);
  cursor: pointer;
}

.icon {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.dressing-room-icon {
  background-image: url('/src/a-game-scenes/home-scene/assets/hero-painting-icon.png');
}

.bag-icon {
  background-image: url('/src/a-game-scenes/home-scene/assets/bag-icon-image.png');
}

.map-icon {
  background-image: url('/src/a-game-scenes/home-scene/assets/map-icon-image.png');
}

.shopPlace {
  position: absolute;
  top: 2vh;
  left: 2vh;
  width: 20vw;
  aspect-ratio: 5 / 3;
  z-index: 2;
  cursor: pointer;
}

.shopBackground {
  width: 100%;
  height: 100%;
  background-image: url('/src/a-game-scenes/home-scene/assets/shop.png');
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.shopPlace:hover .shopBackground {
  transform: scale(1.02);
  box-shadow: 0 0 15px rgba(255, 240, 150, 0.5);
}

.scalableGridWrapper {
  transform: scale(1.01);
  transform-origin: center center;
  transition: transform 0.3s ease;
  position: relative;
}
</style>

