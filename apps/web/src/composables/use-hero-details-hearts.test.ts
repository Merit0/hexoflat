import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { useHeroStore } from '@/stores/hero-store';
import { applyProgress } from '@/services/inventory/inventory-sync';
import { resetInventorySession } from '@/services/inventory/inventory-session';
import { useHeroDetails } from './use-hero-details';

describe('hero details hearts follow the allowed maximum', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    resetInventorySession();
  });

  it('shows one heart frame per allowed heart, including those a shield adds', async () => {
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(3);

    const scope = effectScope();
    const view = scope.run(() => {
      heroStore.loadKnowledge();
      return useHeroDetails();
    })!;

    expect(view.value.hearts).toMatchObject({ max: 3, count: 3, current: 3 });

    applyProgress({ revision: 1, state: { health: { current: 4, bonus: 1, debt: 0 } } });
    await nextTick();

    expect(view.value.hearts).toMatchObject({ max: 4, count: 4, current: 4 });

    applyProgress({ revision: 2, state: { health: { current: 3, bonus: 0, debt: 0 } } });
    await nextTick();

    expect(view.value.hearts).toMatchObject({ max: 3, count: 3, current: 3 });
  });

  it('leaves the new heart empty for a hurt hero', async () => {
    const heroStore = useHeroStore();
    heroStore.hero.setMaxHealth(3).setHealth(2);

    const scope = effectScope();
    const view = scope.run(() => {
      heroStore.loadKnowledge();
      return useHeroDetails();
    })!;

    applyProgress({ revision: 1, state: { health: { current: 2, bonus: 1, debt: 0 } } });
    await nextTick();

    expect(view.value.hearts).toMatchObject({ max: 4, count: 4, current: 2 });
  });
});
