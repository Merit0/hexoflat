<template>
  <div
    v-if="!isDragging"
    class="equip-slot-token"
    :data-testid="`equip-token-${item.id}`"
    :class="{
      'is-usable-tool': isUsableTool,
    }"
    :style="tokenStyle"
    @pointerdown="onPointerDown"
  >
    <div class="icon" :style="iconStyle"></div>

    <button
      v-if="isUsableTool"
      class="hex-use-btn"
      :data-testid="`equip-token-use-button-${item.id}`"
      type="button"
      @click.stop="useToolToken()"
      @pointerdown.stop
    >
      USE
    </button>
  </div>

  <Teleport to="body">
    <div v-if="isDragging" class="equip-slot-token drag-ghost" :style="dragGhostStyle">
      <div class="icon" :style="iconStyle"></div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroStore } from '@/stores/hero-store';
import { useOverlayStore } from '@/stores/overlay-store';
import { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { inventoryDragState, useInventoryDragHandle } from '@/composables/use-inventory-drag';

const props = defineProps<{
  item: InventoryItem;
}>();

const inventoryStore = useHeroInventoryStore();
const heroToolStore = useHeroToolStore();
const heroStore = useHeroStore();
const overlayStore = useOverlayStore();
const dragHandle = useInventoryDragHandle(() => props.item.id);

const isDragging = computed(() => inventoryDragState.draggingId === props.item.id);
const rotation = computed(() => inventoryStore.ensureRotation(props.item.id));
const isUsableTool = computed(() => {
  return (
    (props.item.type === EHexobjectGroup.TOOL || props.item.type === EHexobjectGroup.EQUIPMENT) &&
    isHandSlotKey(props.item.slotKey)
  );
});

const tokenStyle = computed(() => ({
  '--rot': `${rotation.value}deg`,
}));

const isDefaultHandToken = computed(() => props.item.key === HEXOBJECT_KEYS.HAND);

const meta = computed(() => resolveInventoryView(props.item.key));

const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : 'none',
}));

const dragGhostStyle = computed<CSSProperties>(() => ({
  position: 'fixed',
  left: `${inventoryDragState.dragPointerX - inventoryDragState.dragOffsetX}px`,
  top: `${inventoryDragState.dragPointerY - inventoryDragState.dragOffsetY}px`,
  width: `${inventoryDragState.dragWidth}px`,
  height: `${inventoryDragState.dragHeight}px`,
  transform: 'translate(0, 0) scale(1.05)',
  zIndex: 9999,
  pointerEvents: 'none',
}));

function resolveToolType(): THeroToolKey | null {
  switch (props.item.key) {
    case HEXOBJECT_KEYS.HAND:
      return HEXOBJECT_KEYS.HAND;
    case HEXOBJECT_KEYS.AXE:
      return HEXOBJECT_KEYS.AXE;
    case HEXOBJECT_KEYS.PICKAXE:
      return HEXOBJECT_KEYS.PICKAXE;
    case HEXOBJECT_KEYS.SWORD:
      return HEXOBJECT_KEYS.SWORD;
    case HEXOBJECT_KEYS.SHIELD:
      return HEXOBJECT_KEYS.SHIELD;
    default:
      return null;
  }
}

function useToolToken() {
  if (!isUsableTool.value) return;

  const toolType = resolveToolType();
  if (!toolType) return;

  const heroCoords = heroStore.heroCoordinates;
  if (!heroCoords) return;

  heroToolStore.activeTool = toolType;
  heroToolStore.useTool(toolType, heroCoords);
  overlayStore.closeOverlay();
}

function isHandSlotKey(slotKey: string) {
  return slotKey === 'eq:weapon' || slotKey === 'eq:shield';
}

function onPointerDown(e: PointerEvent) {
  // дефолтну руку не драгати
  if (isDefaultHandToken.value) return;

  dragHandle.onPointerDown(e);
}
</script>

<style scoped>
.equip-slot-token {
  position: absolute;
  inset: 5%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transform: rotate(var(--rot));
  transform-origin: center center;
  transition:
    transform 0.08s linear,
    filter 0.12s ease;
}

.equip-slot-token:active {
  cursor: grabbing;
}

.equip-slot-token:hover {
  transform: scale(1.05);
  filter: brightness(1.06);
}

.drag-ghost {
  inset: auto;
  transition: none !important;
  filter: brightness(1.12) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.45));
  scale: 0.6;
}

.icon {
  width: 100%;
  height: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.45));
}

.equip-slot-token.is-usable-tool:hover .hex-use-btn {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(-2px);
}

.hex-use-btn {
  position: absolute;
  inset: auto auto 2px 50%;
  transform: translateX(-50%);
  min-width: 52px;
  height: 22px;
  padding: 0 10px;
  border: 1px solid rgba(255, 230, 170, 0.45);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(36, 27, 17, 0.94), rgba(18, 12, 8, 0.96));
  color: rgba(255, 236, 186, 0.96);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    filter 0.12s ease;
}

.hex-use-btn:hover {
  filter: brightness(1.08);
}
</style>
