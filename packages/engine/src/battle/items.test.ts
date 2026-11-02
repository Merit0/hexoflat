import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleItem } from './battle-catalogue';
import type { BattleState } from './battle-state';
import {
  battleWith,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  skeleton,
} from './battle-test-setup';

function twoBlades(): BattleState {
  return giveTurn(
    battleWith([
      hero({ q: 0, r: 0 }, { hands: { right: battleItem('sword'), left: battleItem('dagger') } }),
      skeleton('s1', { q: 1, r: 0 }, { hp: 10, maxHp: 10 }),
    ]),
    ['hero', 's1'],
  );
}

describe('REQ-BTL-004 hands', () => {
  it('strikes once with each weapon in hand, each with its own power', () => {
    let battle = heroDoes(twoBlades(), { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'left' }).battle;
    expect(battle.pending).toEqual([]);
    expect(battle.creatures[1].hp).toBe(7);
    expect(battle.turnWill).toBe(6);
    expect(
      rejectionOf(heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'left' }).events),
    ).toBe('HAND_ALREADY_STRUCK');
  });

  it('cannot strike with a shield, but an empty hand strikes for half a heart', () => {
    const battle = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hands: { right: null, left: battleItem('wooden-shield') } }),
        skeleton('s1', { q: 1, r: 0 }),
      ]),
      ['hero', 's1'],
    );
    expect(
      rejectionOf(heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'left' }).events),
    ).toBe('NO_WEAPON_IN_HAND');
    const punched = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(punched.creatures[1].hp).toBe(3 - BATTLE_RULES.unarmedPower);
    expect(BATTLE_RULES.unarmedPower).toBe(1);
  });
});

describe('REQ-BTL-011 swap and use', () => {
  function withBag(): BattleState {
    return giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hp: 3, bag: [battleItem('health-potion'), battleItem('dagger')] }),
        skeleton('s1', { q: 3, r: 0 }),
      ]),
      ['hero', 's1'],
    );
  }

  it('swaps an item from the bag into a hand for 4 Will and stows the old one', () => {
    const { battle, events } = heroDoes(withBag(), {
      kind: 'swap-item',
      hand: 'left',
      bagIndex: 0,
    });
    expect(battle.turnWill).toBe(16);
    expect(battle.creatures[0].hands.left!.key).toBe('health-potion');
    expect(battle.creatures[0].bag.map((i) => i.key)).toEqual(['dagger', 'wooden-shield']);
    expect(eventTypes(events)).toEqual(['ITEM_SWAPPED']);
  });

  it('drinks a potion for 3 Will: +2 half-hearts, never above the maximum, the hand empties', () => {
    let battle = heroDoes(withBag(), { kind: 'swap-item', hand: 'left', bagIndex: 0 }).battle;
    battle = heroDoes(battle, { kind: 'use-item', hand: 'left' }).battle;
    expect(battle.creatures[0].hp).toBe(5);
    expect(battle.creatures[0].hands.left).toBeNull();
    expect(battle.turnWill).toBe(13);

    const nearlyFull = withBag();
    nearlyFull.creatures[0].hp = 5;
    const capped = heroDoes(nearlyFull, { kind: 'swap-item', hand: 'left', bagIndex: 0 }).battle;
    const after = heroDoes(capped, { kind: 'use-item', hand: 'left' });
    expect(after.battle.creatures[0].hp).toBe(6);
    expect(after.events[0].payload).toMatchObject({ healed: 1 });
  });

  it('refuses to use a weapon, a missing bag slot, or an empty hand, without spending Will', () => {
    const battle = withBag();
    expect(rejectionOf(heroDoes(battle, { kind: 'use-item', hand: 'right' }).events)).toBe(
      'NOT_USABLE',
    );
    expect(
      rejectionOf(heroDoes(battle, { kind: 'swap-item', hand: 'right', bagIndex: 5 }).events),
    ).toBe('NO_SUCH_ITEM');
    battle.creatures[0].hands.left = null;
    expect(rejectionOf(heroDoes(battle, { kind: 'use-item', hand: 'left' }).events)).toBe(
      'NO_SUCH_ITEM',
    );
  });

  it('forgets the undo history after a swap', () => {
    let battle = heroDoes(withBag(), { kind: 'move', hex: { q: -1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'swap-item', hand: 'left', bagIndex: 1 }).battle;
    expect(rejectionOf(heroDoes(battle, { kind: 'undo-step' }).events)).toBe('NOTHING_TO_UNDO');
  });
});
