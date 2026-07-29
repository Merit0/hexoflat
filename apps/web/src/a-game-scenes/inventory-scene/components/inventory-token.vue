<template>
  <div
    v-if="!isDragging"
    class="token"
    :data-testid="`inventory-token-${item.id}`"
    :class="{
      'is-selected': isSelected,
    }"
    :style="tokenStyle"
    @pointerdown.prevent="onPointerDown"
    @click="onClick"
  >
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
import { computed, type CSSProperties } from 'vue';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { useInventoryDragHandle } from '@/composables/use-inventory-drag';

const props = defineProps<{ item: InventoryItem }>();

const inventoryStore = useHeroInventoryStore();
const { onPointerDown } = useInventoryDragHandle(() => props.item.id);

const isDragging = computed(() => inventoryStore.draggingId === props.item.id);
const isSelected = computed(() => inventoryStore.selectedItemId === props.item.id);
const rotation = computed(() => inventoryStore.ensureRotation(props.item.id));
const meta = computed(() => resolveInventoryView(props.item.key));

const tokenStyle = computed(() => ({
  '--rot': `${rotation.value}deg`,
}));

const dragGhostStyle = computed<CSSProperties>(() => {
  const snap = inventoryStore.dragOverSlot ? 1.12 : 1.05;

  return {
    position: 'fixed',
    left: `${inventoryStore.dragPointerX - inventoryStore.dragOffsetX}px`,
    top: `${inventoryStore.dragPointerY - inventoryStore.dragOffsetY}px`,
    width: `${inventoryStore.dragWidth}px`,
    height: `${inventoryStore.dragHeight}px`,
    transform: `translate(0,0) scale(${snap})`,
    zIndex: 9999,
    pointerEvents: 'none',
  };
});

const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : 'none',
}));

function onClick() {
  if (inventoryStore.isDragging) return;
  inventoryStore.toggleSelect(props.item.id);
}
</script>

<style scoped>
.token {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 110%;
  height: 110%;
  transform: translate(-50%, -50%) rotate(var(--rot)) scale(1);
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
  transform: translate(-50%, -50%) rotate(0deg) scale(1.06);
  z-index: 5;
  filter: brightness(1.08);
}

.drag-ghost {
  transition: none !important;
  filter: brightness(1.15);
}

.icon {
  position: absolute;
  inset: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.55));
}
</style>
