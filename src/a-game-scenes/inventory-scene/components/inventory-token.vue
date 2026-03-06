<template>
  <div
      class="token"
      :class="{
    'is-dragging': isDragging,
    'is-selected': isSelected
  }"
      :style="tokenStyle"
      @pointerdown.prevent="onPointerDown"
      @click="onClick"
  >
    <div class="icon" :style="iconStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useHeroInventoryStore, type InventoryItem } from "@/stores/hero-inventory-store";
import { resolveInventoryView } from "@/utils/inventory/traits-resolver";

const props = defineProps<{ item: InventoryItem }>();
const inventoryStore = useHeroInventoryStore();

const isDragging = computed(() => inventoryStore.draggingId === props.item.id);
const rotation = computed(() => inventoryStore.ensureRotation(props.item.id));
const meta = computed(() => resolveInventoryView(props.item.key));

const tokenStyle = computed(() => {
  if (isDragging.value) {
    return {
      position: "fixed",
      left: `${inventoryStore.dragPointerX - inventoryStore.dragOffsetX}px`,
      top: `${inventoryStore.dragPointerY - inventoryStore.dragOffsetY}px`,
      width: `${inventoryStore.dragWidth}px`,
      height: `${inventoryStore.dragHeight}px`,
      transform: "translate(0,0) rotate(0deg) scale(1.05)",
      zIndex: 9999,
    };
  }

  return {
    "--rot": `${rotation.value}deg`,
  };
});

const isSelected = computed(() => inventoryStore.selectedItemId === props.item.id);

const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : "none",
}));

function onClick() {
  if (inventoryStore.isDragging) return;
  inventoryStore.toggleSelect(props.item.id);
}

function getSlotKeyFromPoint(x: number, y: number): string | null {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];
  const cell = els.find(el =>
      el instanceof HTMLElement &&
      el.classList.contains("cell") &&
      !el.classList.contains("blocked")
  );
  return cell?.dataset.slotkey ?? null;
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();

  let dragStarted = false;

  const startX = e.clientX;
  const startY = e.clientY;

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    if (!dragStarted && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragStarted = true;
      inventoryStore.startDrag(props.item.id, startX, startY, rect);
    }

    if (!dragStarted) return;

    inventoryStore.updateDragPointer(ev.clientX, ev.clientY);

    const slot = getSlotKeyFromPoint(ev.clientX, ev.clientY);
    inventoryStore.setDragOver(slot);
  };

  const onUp = (ev: PointerEvent) => {
    if (dragStarted) {
      const slot = getSlotKeyFromPoint(ev.clientX, ev.clientY);
      inventoryStore.dropTo(slot);
    }

    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

onBeforeUnmount(() => {
  if (inventoryStore.draggingId === props.item.id) inventoryStore.cancelDrag();
});
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
  transition: transform 0.08s linear, filter 0.12s ease;
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

.token.is-dragging {
  filter: brightness(1.15);
  z-index: 9999;
  transition: none !important;
  pointer-events: none;
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