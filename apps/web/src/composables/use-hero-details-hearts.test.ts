import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useEquipmentHealthSync } from './use-equipment-health-sync';
import { useHeroDetails } from './use-hero-details';

describe('hero details hearts follow the allowed maximum', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('shows one heart frame per allowed heart, including those a shield adds', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(3);

    const scope = effectScope();
    const view = scope.run(() => {
      useEquipmentHealthSync();
      return useHeroDetails();
    })!;

    expect(view.value.hearts).toMatchObject({ max: 3, count: 3, current: 3 });

    inventory.items.push({
      id: 'shield-1',
      key: HEXOBJECT_KEYS.SHIELD,
      slotKey: 'eq:shield',
      amount: 1,
    } as InventoryItem);
    await nextTick();

    expect(view.value.hearts).toMatchObject({ max: 4, count: 4, current: 4 });

    inventory.items[0].slotKey = 'bag:0';
    await nextTick();

    expect(view.value.hearts).toMatchObject({ max: 3, count: 3, current: 3 });
  });

  it('leaves the new heart empty for a hurt hero', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(2);

    const scope = effectScope();
    const view = scope.run(() => {
      useEquipmentHealthSync();
      return useHeroDetails();
    })!;

    inventory.items.push({
      id: 'shield-1',
      key: HEXOBJECT_KEYS.SHIELD,
      slotKey: 'eq:shield',
      amount: 1,
    } as InventoryItem);
    await nextTick();

    expect(view.value.hearts).toMatchObject({ max: 4, count: 4, current: 2 });
  });
});
