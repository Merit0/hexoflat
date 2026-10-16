<template>
  <div
    v-if="!isDragging"
    class="token"
    :data-testid="`inventory-token-${item.id}`"
    :class="{
      'is-selected': isSelected,
    }"
    :style="tokenStyle"
    tabindex="0"
    @pointerdown.prevent="onPointerDown"
    @click="onClick"
    @mouseenter="showItemTooltip(item.id, $event.currentTarget as HTMLElement)"
    @mouseleave="hideItemTooltip()"
    @focus="showItemTooltip(item.id, $event.currentTarget as HTMLElement)"
    @blur="hideItemTooltip()"
  >
    <div v-if="frameStyle" class="rarity-glow" :style="frameStyle" aria-hidden="true"></div>
    <div class="icon" :style="iconStyle"></div>
  </div>

  <Teleport to="body">
    <div
      v-if="isDragging"
      class="token drag-ghost"
      :data-testid="`inventory-token-${item.id}-drag-ghost`"
      :style="dragGhostStyle"
    >
      <div class="icon" :style="iconStyle"></div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, type CSSProperties } from 'vue';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { inventoryDragState, useInventoryDragHandle } from '@/composables/use-inventory-drag';
import { rarityFrameUrlForKey } from '@/render/rarity';
import { hideItemTooltip, showItemTooltip } from '@/composables/use-item-tooltip';

const props = defineProps<{ item: InventoryItem }>();

onBeforeUnmount(hideItemTooltip);

const inventoryStore = useHeroInventoryStore();
const { onPointerDown } = useInventoryDragHandle(() => props.item.id);

const isDragging = computed(() => inventoryDragState.draggingId === props.item.id);
const isSelected = computed(() => inventoryStore.selectedItemId === props.item.id);
const rotation = computed(() => inventoryStore.ensureRotation(props.item.id));
const meta = computed(() => resolveInventoryView(props.item.key));

const tokenStyle = computed(() => ({
  '--rot': `${rotation.value}deg`,
}));

const dragGhostStyle = computed<CSSProperties>(() => {
  const snap = inventoryDragState.dragOverSlot ? 1.12 : 1.05;

  return {
    position: 'fixed',
    left: `${inventoryDragState.dragPointerX - inventoryDragState.dragOffsetX}px`,
    top: `${inventoryDragState.dragPointerY - inventoryDragState.dragOffsetY}px`,
    width: `${inventoryDragState.dragWidth}px`,
    height: `${inventoryDragState.dragHeight}px`,
    transform: `translate(0,0) scale(${snap})`,
    zIndex: 9999,
    pointerEvents: 'none',
  };
});

const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : 'none',
}));

const frameStyle = computed(() => {
  const url = rarityFrameUrlForKey(props.item.key);
  return url ? { backgroundImage: `url("${url}")` } : null;
});

function onClick() {
  if (inventoryDragState.isDragging) return;
  hideItemTooltip();
  inventoryStore.toggleSelect(props.item.id);
}
</script>

<style scoped>
.token {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  cursor: grab;
  user-select: none;
  touch-action: none;
  will-change: transform;
  transition:
    transform 0.08s linear,
    filter 0.12s ease;
}

.token:active {
  cursor: grabbing;
}

.token:hover,
.token.is-selected {
  z-index: 5;
  filter: brightness(1.08);
}

.drag-ghost {
  transition: none !important;
  filter: brightness(1.15);
}

/* Crop the round light sprite to the square slot, including its corners. */
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
.token:hover .icon,
.token.is-selected .icon {
  transform: rotate(0deg) scale(1.06);
}
</style>
