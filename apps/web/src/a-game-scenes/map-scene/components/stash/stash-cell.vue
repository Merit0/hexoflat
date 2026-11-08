<template>
  <div
    class="cell"
    :class="{ 'is-empty': !item }"
    :data-testid="testid"
    :data-item-key="item?.key"
    :data-item-amount="item?.amount"
    :data-rarity="rarity"
  >
    <slot name="placeholder" />
    <stash-item-token v-if="item" :item="item" />
    <span v-if="item && item.amount > 1" class="amount">{{ item.amount }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { getObjectRarityTone } from '@/render/rarity';
import StashItemToken from './stash-item-token.vue';

const props = defineProps<{ item: InventoryItem | null; testid: string }>();

const rarity = computed(() =>
  props.item ? (getObjectRarityTone(getPrototype(props.item.key)) ?? undefined) : undefined,
);
</script>

<style scoped>
.cell {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}
.cell:hover {
  background: rgba(138, 173, 180, 0.3);
}
.cell.is-empty {
  background: rgba(120, 160, 170, 0.12);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.35);
}
.amount {
  position: absolute;
  bottom: 0;
  right: 0;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 900;
  font-size: 11px;
  pointer-events: none;
}
</style>
