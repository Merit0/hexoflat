<template>
  <button
    type="button"
    class="board-icon-button close-btn"
    :data-testid="testid"
    :aria-label="label"
    @click="emit('close')"
  >
    ×
  </button>
</template>

<script setup lang="ts">
defineProps<{ testid: string; label: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<style scoped src="./board-icon-button.css"></style>
<style scoped>
.board-icon-button.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
}
</style>
