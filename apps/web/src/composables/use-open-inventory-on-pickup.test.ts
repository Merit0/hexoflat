import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useOpenInventoryOnPickup } from './use-open-inventory-on-pickup';

describe('useOpenInventoryOnPickup', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('fires when an item is picked up after the inventory is loaded', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const onPickup = vi.fn();
    effectScope().run(() => useOpenInventoryOnPickup(onPickup));

    expect(inventory.putToInventory(HEXOBJECT_KEYS.AXE, 1).ok).toBe(true);

    expect(onPickup).toHaveBeenCalled();
  });

  it('stays quiet while the saved inventory is being loaded', () => {
    const inventory = useHeroInventoryStore();
    const onPickup = vi.fn();
    effectScope().run(() => useOpenInventoryOnPickup(onPickup));

    inventory.hydrate();

    expect(onPickup).not.toHaveBeenCalled();
  });

  it('stays quiet when items only move or leave', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(HEXOBJECT_KEYS.AXE, 1);
    const onPickup = vi.fn();
    effectScope().run(() => useOpenInventoryOnPickup(onPickup));

    const axe = inventory.items.find((item) => item.key === HEXOBJECT_KEYS.AXE)!;
    axe.slotKey = 'r0c3';
    inventory.removeItem(axe.id);

    expect(onPickup).not.toHaveBeenCalled();
  });

  it('ignores the bare hands that refill an emptied equipment slot', () => {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const onPickup = vi.fn();
    effectScope().run(() => useOpenInventoryOnPickup(onPickup));

    inventory.items.push({
      id: 'hand-extra',
      key: HEXOBJECT_KEYS.HAND,
      slotKey: 'r0c4',
      amount: 1,
    } as (typeof inventory.items)[number]);

    expect(onPickup).not.toHaveBeenCalled();
  });
});
