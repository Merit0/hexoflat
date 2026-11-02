import { describe, expect, it } from 'vitest';
import type { BattleHand, BattleItem } from '@hexoflat/engine/battle/battle-state';
import { weaponHandsLeft } from './battle-tool-hex';

const SWORD: BattleItem = { key: 'sword', power: 2 };
const SHIELD: BattleItem = { key: 'wooden-shield', shieldCapacity: 2 };

function left(
  hands: Partial<Record<BattleHand, BattleItem | null>>,
  struckHands: BattleHand[] = [],
): BattleHand[] {
  return weaponHandsLeft(
    { struckHands },
    { hands: { right: hands.right ?? null, left: hands.left ?? null } },
  );
}

describe('weaponHandsLeft', () => {
  it('has nothing left after the only weapon struck, so the tool hex can hide', () => {
    expect(left({ right: SWORD, left: SHIELD }, ['right'])).toEqual([]);
  });

  it('keeps the tool open while a second weapon has not struck', () => {
    expect(left({ right: SWORD, left: SWORD }, ['right'])).toEqual(['left']);
  });

  it('counts a bare hand as no weapon', () => {
    expect(left({ right: SWORD }, ['right'])).toEqual([]);
    expect(left({})).toEqual([]);
  });

  it('lists both hands before any strike', () => {
    expect(left({ right: SWORD, left: SWORD })).toEqual(['right', 'left']);
  });
});
