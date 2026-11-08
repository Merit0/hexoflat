import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { showsCounter } from './item-counter';

describe('showsCounter', () => {
  it('gives every stackable item a counter, like Will has, even a stack of one', () => {
    for (const key of [K.COINS, K.HEALTH_BOTTLE, K.RETURN_SCROLL, K.BONE_CHARM]) {
      expect(showsCounter({ key })).toBe(true);
    }
  });

  it('gives gear and tools none', () => {
    for (const key of [K.SWORD, K.SHIELD, K.AXE, K.PICKAXE, K.HAND]) {
      expect(showsCounter({ key })).toBe(false);
    }
    expect(showsCounter(null)).toBe(false);
    expect(showsCounter(undefined)).toBe(false);
  });
});
