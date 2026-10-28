import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import type { BattleCreature, BattleState, BattleTerrain, Boulder } from './battle-state';
import {
  battleWith,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  hexagonBoard,
  rejectionOf,
  rightAnswer,
  skeleton,
  wrongAnswer,
} from './battle-test-setup';
import { findDisplaceable, resolveDisplacement } from './displacement';

const T0 = 1_000;

function scene(
  creatures: BattleCreature[],
  terrain: Record<string, BattleTerrain> = {},
  boulders: Boulder[] = [],
): BattleState {
  return giveTurn(battleWith(creatures, hexagonBoard(3, terrain), 'push-seed', boulders), [
    'hero',
    ...creatures.filter((c) => c.id !== 'hero').map((c) => c.id),
  ]);
}

function pushAndAnswer(battle: BattleState, targetId: string, right = true) {
  const opened = heroDoes(battle, { kind: 'push', targetId }, 'hero', T0).battle;
  const option = right ? rightAnswer(opened) : wrongAnswer(opened);
  return heroDoes(opened, { kind: 'answer-task', option }, 'hero', T0 + 1_000);
}

describe('REQ-BTL-008 push and pull', () => {
  it('pushes a light enemy one hex away after a right answer, for 6 Will', () => {
    const battle = scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    const opened = heroDoes(battle, { kind: 'push', targetId: 's1' }, 'hero', T0).battle;
    expect(opened.task!.kind).toBe('push');
    expect(opened.turnWill).toBe(14);
    const { battle: after, events } = heroDoes(
      opened,
      { kind: 'answer-task', option: rightAnswer(opened) },
      'hero',
      T0 + 1_000,
    );
    expect(after.creatures[1].pos).toEqual({ q: 2, r: 0 });
    expect(eventTypes(events)).toContain('DISPLACED');
  });

  it('keeps the Will spent and the target in place after a wrong answer', () => {
    const { battle, events } = pushAndAnswer(
      scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]),
      's1',
      false,
    );
    expect(battle.creatures[1].pos).toEqual({ q: 1, r: 0 });
    expect(battle.turnWill).toBe(14);
    expect(eventTypes(events)).toContain('DISPLACE_FAILED');
  });

  it('refuses a target heavier than the force, and a push into a wall, without spending Will', () => {
    const king = skeleton('k', { q: 1, r: 0 }, { kind: 'skeleton-king', weight: 3 });
    const heavy = heroDoes(scene([hero({ q: 0, r: 0 }), king]), { kind: 'push', targetId: 'k' });
    expect(rejectionOf(heavy.events)).toBe('TOO_HEAVY');

    const walled = scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })], { '2,0': 'wall' });
    const blocked = heroDoes(walled, { kind: 'push', targetId: 's1' });
    expect(rejectionOf(blocked.events)).toBe('NO_SPACE');
    expect(blocked.battle.turnWill).toBe(20);
  });

  it('slides one more hex on oil', () => {
    const { battle, events } = pushAndAnswer(
      scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })], { '2,0': 'oil' }),
      's1',
    );
    expect(battle.creatures[1].pos).toEqual({ q: 3, r: 0 });
    expect(events.find((e) => e.type === 'DISPLACED')!.payload).toMatchObject({ slid: true });
  });

  it('takes half a heart when pushed off a ledge', () => {
    const { battle } = pushAndAnswer(
      scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })], { '1,0': 'ledge' }),
      's1',
    );
    expect(battle.creatures[1].hp).toBe(2);
  });

  it('keeps the strikes waiting on a pushed enemy', () => {
    let battle = scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    const pending = structuredClone(battle.pending);
    battle = pushAndAnswer(battle, 's1').battle;
    expect(battle.pending).toEqual(pending);
  });

  it('pulls an enemy from two hexes away onto a free hex next to the hero, for 8 Will', () => {
    const battle = scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]);
    const opened = heroDoes(battle, { kind: 'pull', targetId: 's1' }, 'hero', T0).battle;
    expect(opened.turnWill).toBe(12);
    const after = heroDoes(
      opened,
      { kind: 'answer-task', option: rightAnswer(opened) },
      'hero',
      T0,
    ).battle;
    expect(after.creatures[1].pos).toEqual({ q: 1, r: 0 });

    const near = heroDoes(scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), {
      kind: 'pull',
      targetId: 's1',
    });
    expect(rejectionOf(near.events)).toBe('OUT_OF_RANGE');
  });

  it('moves a boulder only with enough force', () => {
    const boulder = { id: 'rock', pos: { q: 1, r: 0 } };
    const weak = heroDoes(
      scene([hero({ q: 0, r: 0 }), skeleton('s1', { q: -3, r: 0 })], {}, [boulder]),
      {
        kind: 'push',
        targetId: 'rock',
      },
    );
    expect(rejectionOf(weak.events)).toBe('TOO_HEAVY');

    const strong = pushAndAnswer(
      scene([hero({ q: 0, r: 0 }, { force: 2 }), skeleton('s1', { q: -3, r: 0 })], {}, [boulder]),
      'rock',
    );
    expect(strong.battle.boulders[0].pos).toEqual({ q: 2, r: 0 });
  });

  it('lets an enemy push without a task', () => {
    const battle = scene([hero({ q: 1, r: 0 }), skeleton('s1', { q: 0, r: 0 }, { force: 2 })]);
    const actor = battle.creatures[1];
    const target = findDisplaceable(battle, 'hero', BATTLE_RULES)!;
    const events = resolveDisplacement(battle, actor, target, 'push', T0, BATTLE_RULES);
    expect(battle.creatures[0].pos).toEqual({ q: 2, r: 0 });
    expect(battle.task).toBeUndefined();
    expect(eventTypes(events)).toEqual(['DISPLACED']);
  });
});
