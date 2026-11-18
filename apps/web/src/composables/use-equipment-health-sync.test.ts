import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { useEquipmentHealthSync } from './use-equipment-health-sync';

function tokenOf(type: string, halfHearts: number): ItemToken {
  const token = upcastToken('hero-1', `bag.${type}`, type)!;
  return {
    ...token,
    attributes: halfHearts > 0 ? [{ key: 'heart', value: halfHearts }] : [],
  };
}

function tokenItem(key: string, slotKey: string, halfHearts: number): InventoryItem {
  return {
    id: `${key}-token`,
    key,
    slotKey,
    amount: 1,
    token: tokenOf(key, halfHearts),
  } as InventoryItem;
}

function shieldItem(slotKey: string): InventoryItem {
  return { id: 'shield-1', key: HEXOBJECT_KEYS.SHIELD, slotKey, amount: 1 } as InventoryItem;
}

describe('useEquipmentHealthSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('keeps a full hero full when a shield is equipped and drops the heart when it is removed', async () => {
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
    expect(heroStore.hero.currentHealth).toBe(4);

    inventory.items[0].slotKey = 'bag:0';
    await nextTick();
    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(3);
    expect(heroStore.hero.currentHealth).toBe(3);
  });

  it('raises only the maximum for a hurt hero', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(2);
    effectScope().run(() => useEquipmentHealthSync());

    inventory.items.push(shieldItem('eq:shield'));
    await nextTick();

    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(4);
    expect(heroStore.hero.currentHealth).toBe(2);
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

  it('counts the heart attribute of a token in half-hearts, the same as the engine', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(3);
    effectScope().run(() => useEquipmentHealthSync());

    inventory.items.push(tokenItem(HEXOBJECT_KEYS.SHIELD, 'eq:shield', 1));
    await nextTick();
    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(3.5);

    inventory.items.push(tokenItem(HEXOBJECT_KEYS.SWORD, 'eq:weapon', 2));
    await nextTick();
    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(4.5);
  });

  it('gives no heart for a token shield without the heart attribute', async () => {
    const inventory = useHeroInventoryStore();
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(3);
    effectScope().run(() => useEquipmentHealthSync());

    inventory.items.push(tokenItem(HEXOBJECT_KEYS.SHIELD, 'eq:shield', 0));
    await nextTick();

    expect(heroStore.hero.getEffectiveMaxHealth()).toBe(3);
  });
});
