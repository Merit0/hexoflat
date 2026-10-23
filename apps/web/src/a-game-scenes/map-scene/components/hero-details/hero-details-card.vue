<template>
  <component :is="tag" class="card" :style="{ '--accent': accent }" data-testid="hero-details-card">
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ accent?: string; tag?: string }>(), {
  accent: '#23292c',
  tag: 'div',
});
</script>

<style scoped>
.card {
  display: grid;
  padding: 16px 20px;
  border-radius: 18px;
  background: #0f1113;
  border: 1px solid var(--accent);
}
</style>
