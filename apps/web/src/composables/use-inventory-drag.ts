import { onBeforeUnmount, reactive } from 'vue';
import {
  equipSlotKey,
  useHeroInventoryStore,
  type TEquipSlot,
} from '@/stores/hero-inventory-store';

type InventoryDragTarget =
  { kind: 'grid'; slotKey: string } | { kind: 'equip'; equipSlot: TEquipSlot } | null;

const DRAG_THRESHOLD_PX = 4;

export interface InventoryDragState {
  draggingId: string | null;
  dragFromSlot: string | null;
  dragOverSlot: string | null;
  isDragging: boolean;
  dragPointerX: number;
  dragPointerY: number;
  dragOffsetX: number;
  dragOffsetY: number;
  dragWidth: number;
  dragHeight: number;
  dragOverEquipSlot: TEquipSlot | null;
}

function initialInventoryDragState(): InventoryDragState {
  return {
    draggingId: null,
    dragFromSlot: null,
    dragOverSlot: null,
    isDragging: false,
    dragPointerX: 0,
    dragPointerY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragWidth: 0,
    dragHeight: 0,
    dragOverEquipSlot: null,
  };
}

export const inventoryDragState = reactive<InventoryDragState>(initialInventoryDragState());

export function resetInventoryDragState(): void {
  Object.assign(inventoryDragState, initialInventoryDragState());
}

export function startInventoryDrag(
  itemId: string,
  fromSlot: string,
  clientX: number,
  clientY: number,
  rect: DOMRect,
) {
  inventoryDragState.draggingId = itemId;
  inventoryDragState.dragFromSlot = fromSlot;
  inventoryDragState.dragOverSlot = null;
  inventoryDragState.dragOverEquipSlot = null;
  inventoryDragState.isDragging = true;

  inventoryDragState.dragOffsetX = clientX - rect.left;
  inventoryDragState.dragOffsetY = clientY - rect.top;

  inventoryDragState.dragPointerX = clientX;
  inventoryDragState.dragPointerY = clientY;

  inventoryDragState.dragWidth = rect.width;
  inventoryDragState.dragHeight = rect.height;
}

export function dropInventoryDragToSlot(
  inventoryStore: ReturnType<typeof useHeroInventoryStore>,
  targetSlot: string | null,
) {
  const { isDragging, draggingId, dragFromSlot } = inventoryDragState;

  if (isDragging && draggingId && dragFromSlot && targetSlot && targetSlot !== dragFromSlot) {
    inventoryStore.moveItemToSlot(draggingId, targetSlot);
  }

  resetInventoryDragState();
}

export function dropInventoryDragToEquip(
  inventoryStore: ReturnType<typeof useHeroInventoryStore>,
  targetEquipSlot: TEquipSlot | null,
) {
  const { isDragging, draggingId } = inventoryDragState;

  if (isDragging && draggingId && targetEquipSlot) {
    inventoryStore.moveItemToSlot(draggingId, equipSlotKey(targetEquipSlot));
  }

  resetInventoryDragState();
}

/**
 * Resolves which inventory drop-target (grid cell or equip slot) sits under
 * a given viewport point. Single source of truth for "what am I hovering
 * over while dragging" — used to be copy-pasted in inventory-token.vue and
 * equip-token.vue.
 */
export function getInventoryDragTargetFromPoint(x: number, y: number): InventoryDragTarget {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];

  const equipHex = els.find(
    (el) => el instanceof HTMLElement && el.classList.contains('equip-hex'),
  );
  if (equipHex) {
    const slot = equipHex.dataset.eqslot as TEquipSlot | undefined;
    if (slot) return { kind: 'equip', equipSlot: slot };
  }

  const cell = els.find(
    (el) =>
      el instanceof HTMLElement &&
      el.classList.contains('cell') &&
      !el.classList.contains('blocked'),
  );
  if (cell) {
    const slotKey = cell.dataset.slotkey;
    if (slotKey) return { kind: 'grid', slotKey };
  }

  return null;
}

/**
 * Wires up pointerdown/move/up handling for dragging a single inventory
 * item (grid token or equipped item) between the grid and equip slots,
 * including the "did the user actually drag, or just click" threshold
 * check and drag-cleanup on unmount.
 *
 * `itemId` is a getter (not a plain value) so the handle always reads the
 * *current* prop even if the owning component is reused for a different
 * item (matches Vue's reactive-prop semantics without extra watchers).
 */
export function useInventoryDragHandle(itemId: () => string) {
  const inventoryStore = useHeroInventoryStore();

  onBeforeUnmount(() => {
    if (inventoryDragState.draggingId === itemId()) {
      resetInventoryDragState();
    }
  });

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    let dragStarted = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!dragStarted && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
        dragStarted = true;
        const item = inventoryStore.items.find((i) => i.id === itemId());
        if (!item) return;
        startInventoryDrag(itemId(), item.slotKey, startX, startY, rect);
      }

      if (!dragStarted) return;

      inventoryDragState.dragPointerX = ev.clientX;
      inventoryDragState.dragPointerY = ev.clientY;

      const dragTarget = getInventoryDragTargetFromPoint(ev.clientX, ev.clientY);

      if (dragTarget?.kind === 'grid') {
        inventoryDragState.dragOverSlot = dragTarget.slotKey;
        inventoryDragState.dragOverEquipSlot = null;
      } else if (dragTarget?.kind === 'equip') {
        inventoryDragState.dragOverSlot = null;
        inventoryDragState.dragOverEquipSlot = dragTarget.equipSlot;
      } else {
        inventoryDragState.dragOverSlot = null;
        inventoryDragState.dragOverEquipSlot = null;
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (dragStarted) {
        const dragTarget = getInventoryDragTargetFromPoint(ev.clientX, ev.clientY);

        if (dragTarget?.kind === 'grid') {
          dropInventoryDragToSlot(inventoryStore, dragTarget.slotKey);
        } else if (dragTarget?.kind === 'equip') {
          dropInventoryDragToEquip(inventoryStore, dragTarget.equipSlot);
        } else {
          resetInventoryDragState();
        }
      }

      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return { onPointerDown };
}
