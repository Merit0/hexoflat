import { onBeforeUnmount } from 'vue';
import { useHeroInventoryStore, type TEquipSlot } from '@/stores/hero-inventory-store';

type InventoryDragTarget =
  { kind: 'grid'; slotKey: string } | { kind: 'equip'; equipSlot: TEquipSlot } | null;

const DRAG_THRESHOLD_PX = 4;

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
    if (inventoryStore.draggingId === itemId()) {
      inventoryStore.cancelDrag();
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
        inventoryStore.startDrag(itemId(), startX, startY, rect);
      }

      if (!dragStarted) return;

      inventoryStore.updateDragPointer(ev.clientX, ev.clientY);

      const dragTarget = getInventoryDragTargetFromPoint(ev.clientX, ev.clientY);

      if (dragTarget?.kind === 'grid') {
        inventoryStore.setDragOver(dragTarget.slotKey);
        inventoryStore.setDragOverEquip(null);
      } else if (dragTarget?.kind === 'equip') {
        inventoryStore.setDragOver(null);
        inventoryStore.setDragOverEquip(dragTarget.equipSlot);
      } else {
        inventoryStore.setDragOver(null);
        inventoryStore.setDragOverEquip(null);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (dragStarted) {
        const dragTarget = getInventoryDragTargetFromPoint(ev.clientX, ev.clientY);

        if (dragTarget?.kind === 'grid') {
          inventoryStore.dropTo(dragTarget.slotKey);
        } else if (dragTarget?.kind === 'equip') {
          inventoryStore.dropToEquip(dragTarget.equipSlot);
        } else {
          inventoryStore.cancelDrag();
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
