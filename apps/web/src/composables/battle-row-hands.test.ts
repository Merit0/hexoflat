import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { battleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { rowHands, rowToolKey } from './battle-row-hands';

describe('rowHands', () => {
  it('always lists the right and the left hand', () => {
    expect(rowHands({ hands: { right: null, left: null } }).map((h) => h.hand)).toEqual([
      'right',
      'left',
    ]);
  });

  it('shows the bare hand sprite for an empty hand', () => {
    const [right] = rowHands({ hands: { right: null, left: null } });
    expect(right).toEqual({ hand: 'right', toolKey: HEXOBJECT_KEYS.HAND, itemKey: null });
  });

  it('shows the real sprite of an item that has one', () => {
    expect(rowToolKey(battleItem('sword'))).toBe(HEXOBJECT_KEYS.SWORD);
    expect(rowToolKey(battleItem('wooden-shield'))).toBe(HEXOBJECT_KEYS.SHIELD);
  });

  it('falls back to a weapon or a shield sprite for enemy-only items', () => {
    expect(rowToolKey(battleItem('bone-blade'))).toBe(HEXOBJECT_KEYS.SWORD);
    expect(rowToolKey(battleItem('bone-buckler'))).toBe(HEXOBJECT_KEYS.SHIELD);
  });

  it('keeps the item key so the row can name what the enemy holds', () => {
    const hands = rowHands({
      hands: { right: battleItem('bone-blade'), left: battleItem('bone-buckler') },
    });
    expect(hands.map((h) => h.itemKey)).toEqual(['bone-blade', 'bone-buckler']);
  });
});
