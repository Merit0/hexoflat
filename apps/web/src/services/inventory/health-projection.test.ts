import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore, type InventoryItem } from '@/stores/hero-inventory-store';
import { applyProgress } from './inventory-sync';
import { resetInventorySession } from './inventory-session';

describe('server health projection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetInventorySession();
  });

  it('restores health received before the hero subscribes, including missing bonus hearts', () => {
    const health = { current: 3, bonus: 0, debt: 1 };
    applyProgress({ revision: 1, state: { health } });
    const store = useHeroStore();
    store.loadKnowledge();
    expect(store.hero.healthState()).toEqual(health);
    applyProgress({ revision: 2, state: { health: { current: 3, bonus: 1, debt: 0 } } });
    expect(store.hero.healthState()).toEqual({ current: 3, bonus: 1, debt: 0 });
  });

  it('waits for server health instead of deriving it from optimistic equipment', async () => {
    const store = useHeroStore();
    store.hero.setMaxHealth(3).setHealth(2.5);
    store.loadKnowledge();
    const inventory = useHeroInventoryStore();
    inventory.items.push({
      id: 'shield-1',
      key: 'shield',
      slotKey: 'eq:shield',
      amount: 1,
    } as InventoryItem);
    await nextTick();
    expect(store.hero.healthState()).toEqual({ current: 2.5, bonus: 0, debt: 0 });
    applyProgress({ revision: 1, state: { health: { current: 2.5, bonus: 0.5, debt: 0 } } });
    expect(store.hero.getEffectiveMaxHealth()).toBe(3.5);
    expect(store.hero.currentHealth).toBe(2.5);
  });
});
