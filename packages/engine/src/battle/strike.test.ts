import { describe, expect, it } from 'vitest';
import {
  battleWith,
  giveTurn,
  hero,
  heroDoes,
  hexagonBoard,
  rejectionOf,
  skeleton,
  strikeOpened,
} from './battle-test-setup';
import type { BattleState } from './battle-state';

function heroNextToSkeleton(
  board = hexagonBoard(),
  heroOverrides = {},
  skeletonOverrides = {},
): BattleState {
  return giveTurn(
    battleWith(
      [hero({ q: 0, r: 0 }, heroOverrides), skeleton('s1', { q: 1, r: 0 }, skeletonOverrides)],
      board,
    ),
    ['hero', 's1'],
  );
}

describe('REQ-BTL-004 melee strike', () => {
  it('costs 7 Will, lands at once on an undefended target and keeps the weapon power', () => {
    const { battle, events } = heroDoes(heroNextToSkeleton(), {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    });
    expect(battle.turnWill).toBe(13);
    expect(battle.creatures[1].hp).toBe(1);
    expect(battle.pending).toEqual([]);
    expect(events[0].type).toBe('STRIKE_DEALT');
    expect(events.map((e) => e.type)).toContain('STRIKE_LANDED');
  });

  it('opens the block window and waits for the defender when the target holds a shield', () => {
    const shielded = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }),
        skeleton(
          's1',
          { q: 1, r: 0 },
          { hands: { right: null, left: { key: 'bone-buckler', shieldCapacity: 1 } } },
        ),
      ]),
      ['s1', 'hero'],
    );
    const opened = strikeOpened(shielded, 'hero', 's1');
    expect(opened.reaction).toMatchObject({ stage: 'block', attackerId: 'hero' });
    expect(opened.pending).toHaveLength(1);
    expect(opened.pending[0]).toMatchObject({ attackerId: 'hero', targetId: 's1', power: 2 });
  });

  it('picks a target that can be reached, and walks to it only after the block window', () => {
    const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), [
      'hero',
      's1',
    ]);
    const { battle: after, events } = heroDoes(battle, {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    });
    expect(events.map((e) => e.type)).toContain('CREATURE_MOVED');
    expect(after.creatures[0].pos).toEqual({ q: 1, r: 0 });
    expect(after.creatures[1].hp).toBe(1);
  });

  it('refuses a target no neighbouring hex of which can be reached with the Will left', () => {
    const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
      'hero',
      's1',
    ]);
    battle.turnWill = 8;
    const { events } = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' });
    expect(rejectionOf(events)).toBe('NOT_ADJACENT');
  });

  it('lets each weapon strike once per turn and refuses an empty or shield hand', () => {
    const twoBlades = {
      hands: { right: { key: 'sword', power: 2 }, left: { key: 'dagger', power: 1 } },
    };
    let battle = heroNextToSkeleton(hexagonBoard(), twoBlades, { hp: 6, maxHp: 6 });
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(
      rejectionOf(heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).events),
    ).toBe('HAND_ALREADY_STRUCK');
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'left' }).battle;
    expect(battle.creatures[1].hp).toBe(3);
    expect(battle.turnWill).toBe(6);

    const shieldHand = heroNextToSkeleton();
    expect(
      rejectionOf(heroDoes(shieldHand, { kind: 'strike', targetId: 's1', hand: 'left' }).events),
    ).toBe('NO_WEAPON_IN_HAND');
  });

  it('adds one to the power when striking down from a ledge', () => {
    const battle = heroNextToSkeleton(hexagonBoard(3, { '0,0': 'ledge' }), {}, { hp: 6, maxHp: 6 });
    const after = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(after.creatures[1].hp).toBe(3);
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
    const ring = strikeOpened(start, 'hero', 's1').pending[0].ring;
    expect(ring).toHaveLength(4);
    expect(ring).toContainEqual({ q: 0, r: 0 });
    expect(ring).not.toContainEqual({ q: 2, r: 0 });
    expect(ring).not.toContainEqual({ q: 2, r: -1 });
  });

  it('keeps the attacker where he stands until the block window closes', () => {
    const battle = strikeOpened(heroNextToSkeleton(), 'hero', 's1');
    expect(battle.creatures[0].pos).toEqual({ q: 0, r: 0 });
    expect(battle.pending[0].fromHex).toEqual({ q: 0, r: 0 });
  });
});
