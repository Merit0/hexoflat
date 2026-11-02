import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { battleToolKeyOf } from './battle-tool-key';

describe('battleToolKeyOf', () => {
  it('uses the sprite of an item the hero also owns', () => {
    expect(battleToolKeyOf('sword')).toBe(HEXOBJECT_KEYS.SWORD);
    expect(battleToolKeyOf('wooden-shield')).toBe(HEXOBJECT_KEYS.SHIELD);
  });

  it('shows a sword for every enemy-only weapon and a shield for every enemy shield', () => {
    for (const key of ['bone-blade', 'king-cleaver', 'bone-bow']) {
      expect(battleToolKeyOf(key)).toBe(HEXOBJECT_KEYS.SWORD);
    }
    expect(battleToolKeyOf('bone-buckler')).toBe(HEXOBJECT_KEYS.SHIELD);
  });

  it('shows the bare hand for no item, for a bare-hand strike and for an unknown key', () => {
    expect(battleToolKeyOf(null)).toBe(HEXOBJECT_KEYS.HAND);
    expect(battleToolKeyOf(undefined)).toBe(HEXOBJECT_KEYS.HAND);
    expect(battleToolKeyOf('unarmed')).toBe(HEXOBJECT_KEYS.HAND);
    expect(battleToolKeyOf('nothing-like-this')).toBe(HEXOBJECT_KEYS.HAND);
  });
});
