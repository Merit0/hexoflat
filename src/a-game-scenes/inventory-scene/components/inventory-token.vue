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
import { computed, onBeforeUnmount } from "vue";
import { useHeroInventoryStore, type InventoryItem } from "@/stores/hero-inventory-store";
import { resolveInventoryView } from "@/utils/inventory/traits-resolver";

const props = defineProps<{ item: InventoryItem }>();
const inventoryStore = useHeroInventoryStore();

const isDragging = computed(() => inventoryStore.draggingId === props.item.id);

const rotation = computed(() => inventoryStore.ensureRotation(props.item.id));
const meta = computed(() => resolveInventoryView(props.item.key));

const tokenStyle = computed(() => ({
  "--rot": `${rotation.value}deg`,
}));

const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : "none",
}));

function onClick() {
  if (inventoryStore.isDragging) return;
  inventoryStore.toggleSelect(props.item.id);
}

const isSelected = computed(() => inventoryStore.selectedItemId === props.item.id);

function getSlotKeyFromPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const cell = el.closest(".cell") as HTMLElement | null;
  if (!cell || cell.classList.contains("blocked")) return null;
  return cell.dataset.slotkey ?? null; // ми це додамо в grid
}

function onPointerDown(e: PointerEvent) {
  // тільки ЛКМ/основний контакт
  if (e.button !== 0) return;

  inventoryStore.startDrag(props.item.id);

  const onMove = (ev: PointerEvent) => {
    const slot = getSlotKeyFromPoint(ev.clientX, ev.clientY);
    inventoryStore.setDragOver(slot);
  };

  const onUp = (ev: PointerEvent) => {
    const slot = getSlotKeyFromPoint(ev.clientX, ev.clientY);
    inventoryStore.dropTo(slot);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

onBeforeUnmount(() => {
  // safety: якщо компонент зник під час drag
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
  transition: transform 0.16s ease, filter 0.16s ease;
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
  z-index: 50;
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