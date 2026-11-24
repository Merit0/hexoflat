import { describe, expect, it } from 'vitest';
import { itemDimensionOf } from './item-dimension';
import { canStackTogether } from './item-queries';
import { emptyInventoryState, mintItem } from './inventory-state';
import { sampleToken } from '../tokens/token-test-setup';
import { ETokenType } from '../abstraction/hexobject-abstraction';

describe('concrete item ownership', () => {
  it('resolves stackables from their own definition and tokens from their own family', () => {
    expect(itemDimensionOf({ key: 'coins' })).toBe('earth');
    expect(itemDimensionOf({ key: 'return-scroll' })).toBe('heaven');
    for (const tokenType of [ETokenType.GLOOM, ETokenType.SPARK, ETokenType.ALIEN]) {
      const token = sampleToken({ tokenType, tier: 'unique', uniqueKey: 'test-unique' });
      expect(itemDimensionOf({ key: 'sword', token })).toBe(token.dimension);
      expect(itemDimensionOf({ key: 'sword', token })).not.toBe('earth');
    }
  });

  it('does not merge foreign objects even if their stack identifiers coincide', () => {
    const state = emptyInventoryState('hero');
    const earth = { ...mintItem(state, 'health-bottle', 1), slotKey: 'bag-0', isNew: false };
    const foreign = {
      ...mintItem(state, 'return-scroll', 1),
      slotKey: 'bag-1',
      isNew: false,
      stackKey: earth.stackKey,
    };
    expect(canStackTogether(earth, { ...earth, id: 'other' })).toBe(true);
    expect(canStackTogether(earth, foreign)).toBe(false);
    expect(canStackTogether({ ...earth, token: sampleToken() }, earth)).toBe(false);
  });
});
