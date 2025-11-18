<template>
  <div class="close-button-container">
    <div class="closeInventoryBtn" @click="$emit('heroInventory'); $emit('heroDressingRoom')">CLOSE</div>
  </div>
</template>
<script lang="ts">

export default {
  name: "CloseHeroInventoryModalButton",
  emits: ["heroInventory", "heroDressingRoom"],
}
</script>

<style scoped>
@import "@/styles/ui-elements/buttons/close-hero-inventory-modal-btn-style.css";
</style>