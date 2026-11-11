import { describe, expect, it } from 'vitest';
import { shopTiltOf } from './shop-tilt';

describe('shop tilt', () => {
  it('keeps the tilt of a shelf cell while its item stays', () => {
    const first = shopTiltOf('goods', 0, 'sword');
    expect(shopTiltOf('goods', 0, 'sword')).toBe(first);
  });

  it('does not touch the hero inventory rotations', async () => {
    const { useHeroInventoryStore } = await import('@/stores/hero-inventory-store');
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());
    shopTiltOf('goods', 3, 'axe');
    expect(Object.keys(useHeroInventoryStore().rotationsById)).toHaveLength(0);
  });
});
