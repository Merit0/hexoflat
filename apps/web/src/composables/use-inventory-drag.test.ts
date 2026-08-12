import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import {
  dropInventoryDragToEquip,
  dropInventoryDragToSlot,
  inventoryDragState,
  resetInventoryDragState,
  startInventoryDrag,
} from './use-inventory-drag';

const RECT = { left: 10, top: 20, width: 64, height: 64 } as DOMRect;

describe('inventory drag state (module-level, no Pinia needed)', () => {
  beforeEach(() => {
    resetInventoryDragState();
  });

  it('starts empty', () => {
    expect(inventoryDragState.isDragging).toBe(false);
    expect(inventoryDragState.draggingId).toBeNull();
  });

  it('startInventoryDrag records the item, origin slot and pointer offset', () => {
    startInventoryDrag('item-1', 'r0c0', 50, 60, RECT);

    expect(inventoryDragState.isDragging).toBe(true);
    expect(inventoryDragState.draggingId).toBe('item-1');
    expect(inventoryDragState.dragFromSlot).toBe('r0c0');
    expect(inventoryDragState.dragOffsetX).toBe(40);
    expect(inventoryDragState.dragOffsetY).toBe(40);
    expect(inventoryDragState.dragWidth).toBe(64);
    expect(inventoryDragState.dragHeight).toBe(64);
  });

  it('resetInventoryDragState clears every field back to its default', () => {
    startInventoryDrag('item-1', 'r0c0', 50, 60, RECT);

    resetInventoryDragState();

    expect(inventoryDragState).toEqual({
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
    });
  });
});

describe('dropInventoryDragToSlot', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetInventoryDragState();
  });

  it('moves the dragged item to the target slot', () => {
    const inventoryStore = useHeroInventoryStore();
    inventoryStore.putToInventory(HEXOBJECT_KEYS.SWORD);
    const item = inventoryStore.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!;
    startInventoryDrag(item.id, item.slotKey, 0, 0, RECT);

    dropInventoryDragToSlot(inventoryStore, 'r0c0');

    expect(inventoryStore.items.find((i) => i.id === item.id)?.slotKey).toBe('r0c0');
  });

  it('resets drag state even when nothing was being dragged', () => {
    const inventoryStore = useHeroInventoryStore();

    expect(() => dropInventoryDragToSlot(inventoryStore, 'r0c0')).not.toThrow();
    expect(inventoryDragState.isDragging).toBe(false);
  });

  it('is a no-op move when dropped back on its own origin slot', () => {
    const inventoryStore = useHeroInventoryStore();
    inventoryStore.putToInventory(HEXOBJECT_KEYS.SWORD);
    const item = inventoryStore.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!;
    startInventoryDrag(item.id, item.slotKey, 0, 0, RECT);

    dropInventoryDragToSlot(inventoryStore, item.slotKey);

    expect(inventoryStore.items.find((i) => i.id === item.id)?.slotKey).toBe(item.slotKey);
  });

  it('always clears drag state after dropping', () => {
    const inventoryStore = useHeroInventoryStore();
    inventoryStore.putToInventory(HEXOBJECT_KEYS.SWORD);
    const item = inventoryStore.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!;
    startInventoryDrag(item.id, item.slotKey, 0, 0, RECT);

    dropInventoryDragToSlot(inventoryStore, 'r0c0');

    expect(inventoryDragState.isDragging).toBe(false);
    expect(inventoryDragState.draggingId).toBeNull();
  });
});

describe('dropInventoryDragToEquip', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetInventoryDragState();
  });

  it('moves the dragged item into the equip slot', () => {
    const inventoryStore = useHeroInventoryStore();
    inventoryStore.putToInventory(HEXOBJECT_KEYS.SWORD);
    const sword = inventoryStore.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!;
    startInventoryDrag(sword.id, sword.slotKey, 0, 0, RECT);

    dropInventoryDragToEquip(inventoryStore, 'weapon');

    expect(inventoryStore.items.find((i) => i.id === sword.id)?.slotKey).toBe('eq:weapon');
  });

  it('resets drag state without throwing when there is no equip target', () => {
    const inventoryStore = useHeroInventoryStore();

    expect(() => dropInventoryDragToEquip(inventoryStore, null)).not.toThrow();
    expect(inventoryDragState.isDragging).toBe(false);
  });
});
