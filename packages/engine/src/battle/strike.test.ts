import { describe, expect, it } from 'vitest';
import {
  battleWith,
  giveTurn,
  hero,
  heroDoes,
  hexagonBoard,
  rejectionOf,
  skeleton,
} from './battle-test-setup';
import type { BattleState } from './battle-state';

function heroNextToSkeleton(board = hexagonBoard(), heroOverrides = {}): BattleState {
  return giveTurn(
    battleWith([hero({ q: 0, r: 0 }, heroOverrides), skeleton('s1', { q: 1, r: 0 })], board),
    ['hero', 's1'],
  );
}

describe('REQ-BTL-004 melee strike', () => {
  it('costs 7 Will, leaves the damage pending and keeps the weapon power', () => {
    const { battle, events } = heroDoes(heroNextToSkeleton(), {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    });
    expect(battle.turnWill).toBe(13);
    expect(battle.creatures[1].hp).toBe(3);
    expect(battle.pending).toHaveLength(1);
    expect(battle.pending[0]).toMatchObject({ attackerId: 'hero', targetId: 's1', power: 2 });
    expect(events[0].type).toBe('STRIKE_DEALT');
  });

  it('strikes only from a neighbouring hex', () => {
    const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), [
      'hero',
      's1',
    ]);
    const { events } = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' });
    expect(rejectionOf(events)).toBe('NOT_ADJACENT');
  });

  it('lets each weapon strike once per turn and refuses an empty or shield hand', () => {
    const twoBlades = {
      hands: { right: { key: 'sword', power: 2 }, left: { key: 'dagger', power: 1 } },
    };
    let battle = heroNextToSkeleton(hexagonBoard(), twoBlades);
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(
      rejectionOf(heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).events),
    ).toBe('HAND_ALREADY_STRUCK');
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'left' }).battle;
    expect(battle.pending.map((s) => s.power)).toEqual([2, 1]);
    expect(battle.turnWill).toBe(6);

    const shieldHand = heroNextToSkeleton();
    expect(
      rejectionOf(heroDoes(shieldHand, { kind: 'strike', targetId: 's1', hand: 'left' }).events),
    ).toBe('NO_WEAPON_IN_HAND');
  });

  it('adds one to the power when striking down from a ledge', () => {
    const battle = heroNextToSkeleton(hexagonBoard(3, { '0,0': 'ledge' }));
    const after = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(after.pending[0].power).toBe(3);
  });

  it('refuses friends and the fallen', () => {
    const battle = heroNextToSkeleton();
    expect(
      rejectionOf(heroDoes(battle, { kind: 'strike', targetId: 'hero', hand: 'right' }).events),
    ).toBe('NOT_AN_ENEMY');

    battle.creatures[1].hp = 0;
    expect(
      rejectionOf(heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).events),
    ).toBe('NOT_AN_ENEMY');
  });
});

describe('REQ-BTL-005 strike ring', () => {
  it('rings the free neighbours of the target, the attacker hex included', () => {
    const board = hexagonBoard(3, { '2,-1': 'wall' });
    const start = giveTurn(
      battleWith(
        [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 }), skeleton('s2', { q: 2, r: 0 })],
        board,
      ),
      ['hero', 's1', 's2'],
    );
    const battle = heroDoes(start, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    const ring = battle.pending[0].ring;
    expect(ring).toHaveLength(4);
    expect(ring).toContainEqual({ q: 0, r: 0 });
    expect(ring).not.toContainEqual({ q: 2, r: 0 });
    expect(ring).not.toContainEqual({ q: 2, r: -1 });
  });

  it('keeps the side and the ring when the attacker walks away', () => {
    let battle = heroDoes(heroNextToSkeleton(), {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    }).battle;
    const before = structuredClone(battle.pending[0]);
    battle = heroDoes(battle, { kind: 'move', hex: { q: -1, r: 0 } }).battle;
    expect(battle.pending[0]).toEqual(before);
    expect(battle.pending[0].fromHex).toEqual({ q: 0, r: 0 });
  });
});
