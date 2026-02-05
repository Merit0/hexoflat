<template>
  <div class="top-component">
    <div class="left-component-bar"></div>
    <div class="middle-component-bar">
      <div class="top-plank-title-container">
        <span class="top-plank-title">{{ hero.name }}</span>
      </div>
    </div>
    <div class="right-component-bar"></div>
  </div>
</template>

<script lang="ts">
import {LootItemModel} from '@/models/LootItemModel';
import {useBagStore} from '@stores/bag-store';
import {useHeroStore} from '@stores/hero-store';


export default {
  name: "InventoryTopElement",
  data() {
    const heroStore = useHeroStore();
    const hero = heroStore.hero;
    const bagStore = useBagStore();
    const bagItems: LootItemModel[] = bagStore.bagItems;

    return {bagItems, hero};
  }
}
</script>

<style>
.top-plank-title-container {
  position: relative;
  margin-top: 2%;
  width: 65vh;
  height: 50%;
  text-align: center;
  align-content: center;
  border-radius: 1vw;
}

.top-plank-title {
  font-family: 'Cinzel', serif;
  color: rgb(64, 27, 1);
  font-size: 3vh;
  font-weight: bold;
  text-align: center;
  line-height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  height: 100%;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.top-component {
  position: absolute;
  top: -6vh;
  left: -1%;
  width: 102%;
  height: 18vh;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  padding: 0;
}

.middle-component-bar {
  position: absolute;
  width: 100%;
  height: 75%;
  background-image: url("/src/a-game-scenes/inventory-scene/assets/hero-inventory-header-image/middle-part.png");
  background-repeat: repeat;
  background-size: contain;
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-content: center;
  flex-direction: column;
}

.left-component-bar {
  position: absolute;
  left: -2%;
  width: 5%;
  height: 100%;
  background-image: url("/src/a-game-scenes/inventory-scene/assets/hero-inventory-header-image/left-part-top-bar.png");
  background-repeat: no-repeat;
  background-size: contain;
  z-index: 1;
}

.right-component-bar {
  position: absolute;
  right: -3%;
  width: 5%;
  height: 100%;
  background-image: url("/src/a-game-scenes/inventory-scene/assets/hero-inventory-header-image/right-part-top-bar.png");
  background-repeat: no-repeat;
  background-size: contain;
}
</style>