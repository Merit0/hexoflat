import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { bindInventoryHandsGate, locationOfSlotKey } from './inventory-moves';
import { autoPlaceItem, previewMove } from './stash-transfer';

describe('locationOfSlotKey', () => {
  it('maps bag cells, hands and stash cells and rejects anything else', () => {
    expect(locationOfSlotKey('r0c1')).toEqual({ container: 'bag', index: 0 });
    expect(locationOfSlotKey('eq:shield')).toEqual({ container: 'equip', slot: 'shield' });
    expect(locationOfSlotKey('stash:7')).toEqual({ container: 'stash', index: 7 });
    for (const bad of ['r0c0', 'r2c4', 'eq:tail', 'stash:x', 'nope']) {
      expect(locationOfSlotKey(bad)).toBeNull();
    }
  });
});

describe('hands while a battle is open', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });
  afterEach(() => bindInventoryHandsGate(null));

  function armed() {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    return { inventory, sword: inventory.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)! };
  }

  it('asks the battle with the hands the move would leave, before anything changes', () => {
    const { inventory, sword } = armed();
    const approve = vi.fn(() => true);
    bindInventoryHandsGate(approve, () => true);

    inventory.moveItemToSlot(sword.id, 'eq:weapon');

    expect(approve).toHaveBeenCalledWith({ weapon: HEXOBJECT_KEYS.SWORD, shield: null });
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.SWORD);
  });

  it('leaves the inventory untouched when the battle refuses the new hands', () => {
    const { inventory, sword } = armed();
    const before = JSON.stringify(inventory.items);
    bindInventoryHandsGate(
      () => false,
      () => true,
    );

    inventory.moveItemToSlot(sword.id, 'eq:weapon');

    expect(JSON.stringify(inventory.items)).toBe(before);
  });

  it('closes every other route to the hands with HANDS_LOCKED', () => {
    const { inventory, sword } = armed();
    useHeroStashStore().setChests(1);
    useHeroStashStore().isOpen = true;
    inventory.moveItemToSlot(sword.id, 'eq:weapon');
    bindInventoryHandsGate(
      () => true,
      () => true,
    );

    expect(autoPlaceItem({ container: 'equip', slot: 'weapon' }, 'stash')).toEqual({
      ok: false,
      reason: 'HANDS_LOCKED',
    });
    expect(
      previewMove({ container: 'equip', slot: 'weapon' }, { container: 'bag', index: 0 }),
    ).toEqual({
      ok: false,
      reason: 'HANDS_LOCKED',
    });
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.SWORD);
  });
});
