import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useEquipmentHealthSync } from './use-equipment-health-sync';

function shieldItem(slotKey: string): InventoryItem {
  return { id: 'shield-1', key: HEXOBJECT_KEYS.SHIELD, slotKey, amount: 1 } as InventoryItem;
}

describe('useEquipmentHealthSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('raises the allowed maximum without healing when a shield is equipped and drops it when removed', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(3);
    effectScope().run(() => useEquipmentHealthSync());

    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(3);

    inventory.items.push(shieldItem('bag:0'));
    await nextTick();
    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(3);

    inventory.items[0].slotKey = 'eq:shield';
    await nextTick();
    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(4);
    expect(heroStore.hero.currentHealth).toBe(3);

    inventory.items[0].slotKey = 'bag:0';
    await nextTick();
    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(3);
    expect(heroStore.hero.currentHealth).toBe(3);
  });

  it('does not grant the heart again when the saved bonus is restored on load', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(3);
    heroStore.hero.maxHealthBonus = 1;
    heroStore.hero.setHealth(3);
    effectScope().run(() => useEquipmentHealthSync());

    inventory.items.push(shieldItem('eq:shield'));
    await nextTick();

    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(4);
    expect(heroStore.hero.currentHealth).toBe(3);
  });
});
