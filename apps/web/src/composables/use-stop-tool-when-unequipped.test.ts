import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useStopToolWhenUnequipped } from './use-stop-tool-when-unequipped';

const COORDS = { columnIndex: 3, rowIndex: 3 };

function shieldItem(): InventoryItem {
  return {
    id: 'shield-1',
    key: HEXOBJECT_KEYS.SHIELD,
    slotKey: 'eq:shield',
    amount: 1,
  } as InventoryItem;
}

describe('useStopToolWhenUnequipped', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('stops the active tool once its item leaves the equipment slots', async () => {
    const inventory = useHeroInventoryStore();
    const heroTool = useHeroToolStore();
    inventory.items.push(shieldItem());
    heroTool.useTool(HEXOBJECT_KEYS.SHIELD, COORDS);

    const onStop = vi.fn();
    effectScope().run(() => useStopToolWhenUnequipped(onStop));

    inventory.items[0].slotKey = 'bag:0';
    await nextTick();

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('keeps the tool while its item stays equipped', async () => {
    const inventory = useHeroInventoryStore();
    const heroTool = useHeroToolStore();
    inventory.items.push(shieldItem());
    heroTool.useTool(HEXOBJECT_KEYS.SHIELD, COORDS);

    const onStop = vi.fn();
    effectScope().run(() => useStopToolWhenUnequipped(onStop));

    inventory.items.push({
      ...shieldItem(),
      id: 'other',
      key: HEXOBJECT_KEYS.COINS,
      slotKey: 'bag:1',
    });
    await nextTick();

    expect(onStop).not.toHaveBeenCalled();
  });

  it('does nothing when no tool is active', async () => {
    const inventory = useHeroInventoryStore();
    inventory.items.push(shieldItem());

    const onStop = vi.fn();
    effectScope().run(() => useStopToolWhenUnequipped(onStop));

    inventory.items[0].slotKey = 'bag:0';
    await nextTick();

    expect(onStop).not.toHaveBeenCalled();
  });
});
