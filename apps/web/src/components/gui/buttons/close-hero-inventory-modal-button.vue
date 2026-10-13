<template>
  <div class="close-button-container">
    <button
      type="button"
      class="closeInventoryBtn"
      data-testid="close-hero-inventory-button"
      @click="$emit('heroInventory')"
    >
      CLOSE
    </button>
  </div>
</template>
<script lang="ts">
export default {
  name: 'CloseHeroInventoryModalButton',
  emits: ['heroInventory'],
};
</script>

<style>
@import '@/styles/ui-elements/buttons/close-hero-inventory-modal-btn-style.css';
</style>
