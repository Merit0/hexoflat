import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { projectBattleEvent, projectBattleForViewer } from './projection';
import {
  battleWith,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  hexagonBoard,
  rejectionOf,
  skeleton,
} from './battle-test-setup';

const SIDE = { q: 1, r: 0 };

function guarded() {
  const start = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
    'hero',
    's1',
  ]);
  return heroDoes(start, { kind: 'place-shield', hex: SIDE });
}

describe('REQ-BTL-017 guard (block as the last stage of the turn)', () => {
  it('puts a shield side on a hex beside the hero for 4 Will, only up to the shield capacity', () => {
    const { battle, events } = guarded();
    expect(events[0]).toMatchObject({ type: 'SHIELD_PLACED', payload: { guard: true } });
    expect(battle.turnWill).toBe(20 - BATTLE_RULES.shieldPerSide);
    const second = heroDoes(battle, { kind: 'place-shield', hex: { q: 0, r: 1 } }).battle;
    const third = heroDoes(second, { kind: 'place-shield', hex: { q: -1, r: 1 } });
    expect(rejectionOf(third.events)).toBe('SHIELD_CAPACITY_REACHED');
  });

  it('refuses a far hex, a wall and a repeated side', () => {
    const board = hexagonBoard(3, { '0,1': 'wall' });
    const start = giveTurn(
      battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })], board),
      ['hero', 's1'],
    );
    expect(rejectionOf(heroDoes(start, { kind: 'place-shield', hex: { q: 2, r: 0 } }).events)).toBe(
      'NOT_ADJACENT',
    );
    expect(rejectionOf(heroDoes(start, { kind: 'place-shield', hex: { q: 0, r: 1 } }).events)).toBe(
      'HEX_BLOCKED',
    );
    const again = heroDoes(start, { kind: 'place-shield', hex: SIDE }).battle;
    expect(rejectionOf(heroDoes(again, { kind: 'place-shield', hex: SIDE }).events)).toBe(
      'SHIELD_ALREADY_PLACED',
    );
  });

  it('takes the shield back for a refund while the turn lasts', () => {
    const { battle } = guarded();
    const lifted = heroDoes(battle, { kind: 'remove-shield', hex: SIDE }).battle;
    expect(lifted.turnWill).toBe(20);
    expect(lifted.placedShields).toEqual([]);
  });

  it('keeps the guard through the end of the turn and blocks the strike that comes from that side', () => {
    const ended = heroDoes(guarded().battle, { kind: 'end-turn' }).battle;
    expect(ended.guards.hero).toEqual([SIDE]);
    expect(ended.placedShields).toEqual([]);

    const struck = {
      id: 'p1',
      attackerId: 's1',
      targetId: 'hero',
      fromHex: SIDE,
      ring: [SIDE, { q: 0, r: 1 }],
      power: 1,
    };
    ended.pending = [struck];
    const defending = giveTurn(ended, ['hero', 's1']);
    expect(defending.phase).toBe('defend');
    expect(defending.placedShields).toEqual([SIDE]);
    expect(defending.lockedShields).toBe(1);
    expect(defending.guards.hero).toBeUndefined();

    const blocked = heroDoes(defending, { kind: 'confirm-block' });
    expect(blocked.battle.creatures[0].hp).toBe(6);
    expect(blocked.events[0].payload).toMatchObject({
      results: [{ outcome: 'blocked', damage: 0 }],
    });
  });

  it('pays nothing back for a guard set on the previous turn', () => {
    const ended = heroDoes(guarded().battle, { kind: 'end-turn' }).battle;
    ended.pending = [
      { id: 'p1', attackerId: 's1', targetId: 'hero', fromHex: SIDE, ring: [SIDE], power: 1 },
    ];
    const defending = giveTurn(ended, ['hero', 's1']);
    const willBefore = defending.turnWill;
    const lifted = heroDoes(defending, { kind: 'remove-shield', hex: SIDE }).battle;
    expect(lifted.turnWill).toBe(willBefore);
    expect(lifted.lockedShields).toBe(0);
  });

  it('forgets the guard when no strike came, and hides it from the other side', () => {
    const ended = heroDoes(guarded().battle, { kind: 'end-turn' }).battle;
    expect(projectBattleForViewer(ended, 'heroes').guards.hero).toEqual([SIDE]);
    expect(projectBattleForViewer(ended, 'enemies').guards).toEqual({});

    const { battle, events } = guarded();
    const placed = projectBattleEvent(battle, events[0], 'enemies');
    expect(placed.payload).toEqual({ creatureId: 'hero', guard: true });

    const next = giveTurn(ended, ['hero', 's1']);
    expect(next.phase).toBe('act');
    expect(next.placedShields).toEqual([]);
    expect(next.guards.hero).toBeUndefined();
  });
});

describe('REQ-BTL-020 defense mode (a raised shield locks movement)', () => {
  function raised() {
    const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
      'hero',
      's1',
    ]);
    return heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
  }

  it('refuses a step while any shield is raised, and the Will stays', () => {
    const battle = raised();
    const step = heroDoes(battle, { kind: 'move', hex: { q: 0, r: 1 } });
    expect(rejectionOf(step.events)).toBe('DEFENSE_MODE');
    expect(step.battle.turnWill).toBe(battle.turnWill);
  });

  it('lets the hero walk again once the last shield is lowered, for free', () => {
    const lowered = heroDoes(raised(), { kind: 'remove-shield', hex: { q: 1, r: 0 } }).battle;
    const step = heroDoes(lowered, { kind: 'move', hex: { q: 0, r: 1 } });
    expect(eventTypes(step.events)).toEqual(['CREATURE_MOVED']);
  });
});
