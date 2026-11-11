<template>
  <div
    class="token"
    :class="{ 'is-ghost': ghost }"
    :style="{ '--rot': `${rotation}deg` }"
    @mouseenter="onEnter"
    @mouseleave="hideItemTooltip()"
  >
    <div v-if="glowStyle && !ghost" class="rarity-glow" :style="glowStyle" aria-hidden="true"></div>
    <div class="icon" :style="iconStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { rarityFrameUrlForKey } from '@/render/rarity';
import {
  hideItemTooltip,
  showItemTooltip,
  type TooltipPrice,
} from '@/composables/use-item-tooltip';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

const props = defineProps<{
  item: InventoryItem;
  ghost?: boolean;
  standalone?: boolean;
  price?: () => TooltipPrice | null;
}>();

const inventory = useHeroInventoryStore();
const rotation = computed(() => inventory.ensureRotation(props.item.id));
const iconStyle = computed(() => {
  const path = resolveInventoryView(props.item.key).iconPath;
  return { backgroundImage: path ? `url("${path}")` : 'none' };
});
const glowStyle = computed(() => {
  const url = rarityFrameUrlForKey(props.item.key);
  return url ? { backgroundImage: `url("${url}")` } : null;
});

function onEnter(event: MouseEvent) {
  if (props.ghost) return;
  showItemTooltip(props.item.id, event.currentTarget as HTMLElement, {
    item: props.standalone ? props.item : undefined,
    price: props.price?.() ?? null,
  });
}

onBeforeUnmount(hideItemTooltip);
</script>

<style scoped>
.token {
  position: absolute;
  inset: 0;
  user-select: none;
}
.token:hover {
  z-index: 5;
  filter: brightness(1.08);
}
.rarity-glow {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 145% 145%;
  pointer-events: none;
}
.icon {
  position: absolute;
  inset: 4%;
  transform: rotate(var(--rot, 0deg));
  transition: transform 0.08s linear;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.55));
}
.token:hover .icon {
  transform: rotate(0deg) scale(1.06);
}
</style>
