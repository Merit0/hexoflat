import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { toolKeyOfItem } from './hand-tools';

describe('toolKeyOfItem', () => {
  it('lets coins in a hand act as a tool, like the scroll', () => {
    expect(toolKeyOfItem(K.COINS)).toBe(K.COINS);
    expect(toolKeyOfItem(K.RETURN_SCROLL)).toBe(K.RETURN_SCROLL);
  });

  it('still ignores items that are not tools', () => {
    expect(toolKeyOfItem(K.HEALTH_BOTTLE)).toBeNull();
    expect(toolKeyOfItem(null)).toBeNull();
    expect(toolKeyOfItem(undefined)).toBeNull();
  });
});
