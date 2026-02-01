<template>
  <div class="battlefield-overlay">
    <battle-info-logger></battle-info-logger>
    <div class="battlefield-overlay-content">
      <battle-map/>
      <battle-controls/>
    </div>
  </div>
  <grave-treasure-inventory-overlay v-if="overlayStore.isOverlay('grave-inventory')"/>
  <confirm-escape-battle-overlay v-if="overlayStore.isOverlay('confirm-escape-battle')"/>
</template>

<script setup lang="ts">
import {useOverlayStore} from "@stores/overlay-store";
import GraveTreasureInventoryOverlay
  from "../../grave/components/grave-treasure-inventory-overlay.vue";
import ConfirmEscapeBattleOverlay
  from "./confirm-escape-battle-overlay.vue";
import BattleInfoLogger from "../../battle-logger/components/battle-info-logger.vue";
import BattleMap from "./battle-map/battle-map.vue";
import BattleControls from "./battle-controls.vue";

const overlayStore = useOverlayStore();

</script>

<style scoped>
@import "../styles/battlefield-overlay-stile.css";
</style>