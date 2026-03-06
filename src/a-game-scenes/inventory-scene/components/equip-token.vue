<template>
  <div
      v-if="!isDragging"
      class="equip-slot-token"
      @pointerdown.prevent="onPointerDown"
  >
    <div class="icon" :style="iconStyle"></div>
  </div>

  <Teleport to="body">
    <div
        v-if="isDragging"
        class="equip-slot-token drag-ghost"
        :style="dragGhostStyle"
    >
      <div class="icon" :style="iconStyle"></div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, Teleport } from "vue";
import {
  useHeroInventoryStore,
  type InventoryItem,
  type TEquipSlot,
} from "@/stores/hero-inventory-store";
import { resolveInventoryView } from "@/utils/inventory/traits-resolver";

type DragTarget =
    | { kind: "grid"; slotKey: string }
    | { kind: "equip"; equipSlot: TEquipSlot }
    | null;

const props = defineProps<{
  item: InventoryItem;
}>();

const inventoryStore = useHeroInventoryStore();

const isDragging = computed(() => inventoryStore.draggingId === props.item.id);

const meta = computed(() => resolveInventoryView(props.item.key));

const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : "none",
}));

const dragGhostStyle = computed(() => ({
  position: "fixed",
  left: `${inventoryStore.dragPointerX - inventoryStore.dragOffsetX}px`,
  top: `${inventoryStore.dragPointerY - inventoryStore.dragOffsetY}px`,
  width: `${inventoryStore.dragWidth}px`,
  height: `${inventoryStore.dragHeight}px`,
  transform: "translate(0, 0) scale(1.05)",
  zIndex: 9999,
  pointerEvents: "none",
}));

function getDragTargetFromPoint(x: number, y: number): DragTarget {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];

  const equipHex = els.find((el) =>
      el instanceof HTMLElement && el.classList.contains("equip-hex")
  );

  if (equipHex) {
    const slot = equipHex.dataset.eqslot as TEquipSlot | undefined;
    if (slot) return { kind: "equip", equipSlot: slot };
  }

  const cell = els.find((el) =>
      el instanceof HTMLElement &&
      el.classList.contains("cell") &&
      !el.classList.contains("blocked")
  );

  if (cell) {
    const slotKey = cell.dataset.slotkey;
    if (slotKey) return { kind: "grid", slotKey };
  }

  return null;
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

    const dragTarget = getDragTargetFromPoint(ev.clientX, ev.clientY);

    if (dragTarget?.kind === "grid") {
      inventoryStore.setDragOver(dragTarget.slotKey);
      inventoryStore.setDragOverEquip(null);
    } else if (dragTarget?.kind === "equip") {
      inventoryStore.setDragOver(null);
      inventoryStore.setDragOverEquip(dragTarget.equipSlot);
    } else {
      inventoryStore.setDragOver(null);
      inventoryStore.setDragOverEquip(null);
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (dragStarted) {
      const dragTarget = getDragTargetFromPoint(ev.clientX, ev.clientY);

      if (dragTarget?.kind === "grid") {
        inventoryStore.dropTo(dragTarget.slotKey);
      } else if (dragTarget?.kind === "equip") {
        inventoryStore.dropToEquip(dragTarget.equipSlot);
      } else {
        inventoryStore.cancelDrag();
      }
    }

    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

onBeforeUnmount(() => {
  if (inventoryStore.draggingId === props.item.id) {
    inventoryStore.cancelDrag();
  }
});
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
  transition: transform 0.08s linear, filter 0.12s ease;
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
  filter:
      brightness(1.12)
      drop-shadow(0 10px 20px rgba(0,0,0,0.45));
  scale: 0.6;
}

.icon {
  width: 100%;
  height: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.45));
}
</style>