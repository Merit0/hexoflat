<template>
  <div class="panel" data-testid="token-details-panel">
    <item-tooltip :view="view" square />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { resolveInventoryItemTooltip } from '@/composables/use-item-tooltip';
import ItemTooltip from '@/components/gui/item-tooltip/item-tooltip.vue';

const props = defineProps<{ item: InventoryItem }>();

const inventory = useHeroInventoryStore();
const heroStore = useHeroStore();
const view = computed(() =>
  resolveInventoryItemTooltip(inventory, props.item, heroStore.knowledge?.skills),
);
</script>

<style scoped>
.panel {
  width: 100%;
  height: 100%;
}
</style>
