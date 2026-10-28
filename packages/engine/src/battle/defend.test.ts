import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import type { BattleState } from './battle-state';
import { battleWith, giveTurn, hero, heroDoes, rejectionOf, skeleton } from './battle-test-setup';
import { beginTurn } from './turn';

function heroUnderAttack(
  strikes: { from: { q: number; r: number }; power: number }[],
  heroOverrides = {},
): BattleState {
  const battle = giveTurn(
    battleWith([hero({ q: 0, r: 0 }, heroOverrides), skeleton('s1', { q: 3, r: 0 })]),
    ['hero', 's1'],
  );
  battle.pending = strikes.map((s, i) => ({
    id: `p${i}`,
    attackerId: 's1',
    targetId: 'hero',
    fromHex: s.from,
    ring: [
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: -1, r: 1 },
      { q: -1, r: 0 },
    ],
    power: s.power,
  }));
  beginTurn(battle, 'hero', BATTLE_RULES);
  return battle;
}

describe('REQ-BTL-006 defend', () => {
  it('blocks a strike whose side carries a shield, then burns every shield', () => {
    let battle = heroUnderAttack([{ from: { q: 1, r: 0 }, power: 2 }]);
    expect(battle.phase).toBe('defend');
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: -1, r: 0 } }).battle;
    expect(battle.turnWill).toBe(12);

    const { battle: after, events } = heroDoes(battle, { kind: 'confirm-block' });
    expect(after.creatures[0].hp).toBe(6);
    expect(after.placedShields).toEqual([]);
    expect(after.pending).toEqual([]);
    expect(after.phase).toBe('act');
    const resolved = events.find((e) => e.type === 'STRIKES_RESOLVED')!.payload as {
      results: { outcome: string }[];
    };
    expect(resolved.results.map((r) => r.outcome)).toEqual(['blocked']);
  });

  it('lets a strike from an unshielded side through', () => {
    let battle = heroUnderAttack([{ from: { q: 0, r: 1 }, power: 2 }]);
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    const after = heroDoes(battle, { kind: 'confirm-block' }).battle;
    expect(after.creatures[0].hp).toBe(4);
  });

  it('uses one set of shields against every waiting strike', () => {
    let battle = heroUnderAttack([
      { from: { q: 1, r: 0 }, power: 1 },
      { from: { q: -1, r: 0 }, power: 1 },
      { from: { q: 0, r: 1 }, power: 1 },
    ]);
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: -1, r: 0 } }).battle;
    expect(heroDoes(battle, { kind: 'confirm-block' }).battle.creatures[0].hp).toBe(5);
  });

  it('caps shields at the capacity of the shield in hand', () => {
    let battle = heroUnderAttack([{ from: { q: 1, r: 0 }, power: 1 }]);
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 0, r: 1 } }).battle;
    expect(
      rejectionOf(heroDoes(battle, { kind: 'place-shield', hex: { q: -1, r: 0 } }).events),
    ).toBe('SHIELD_CAPACITY_REACHED');
  });

  it('refuses shields without a shield in hand and off the ring', () => {
    const noShield = heroUnderAttack([{ from: { q: 1, r: 0 }, power: 1 }], {
      hands: { right: { key: 'sword', power: 2 }, left: null },
    });
    expect(
      rejectionOf(heroDoes(noShield, { kind: 'place-shield', hex: { q: 1, r: 0 } }).events),
    ).toBe('NO_SHIELD_IN_HAND');

    const battle = heroUnderAttack([{ from: { q: 1, r: 0 }, power: 1 }]);
    expect(
      rejectionOf(heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: -1 } }).events),
    ).toBe('NOT_IN_RING');
    expect(rejectionOf(heroDoes(battle, { kind: 'confirm-block' }).events)).toBe(
      'NO_SHIELD_PLACED',
    );
  });

  it('takes a raised shield back for its Will', () => {
    let battle = heroUnderAttack([{ from: { q: 1, r: 0 }, power: 1 }]);
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'remove-shield', hex: { q: 1, r: 0 } }).battle;
    expect(battle.turnWill).toBe(20);
    expect(battle.placedShields).toEqual([]);
  });

  it('takes every hit for free when the hero skips the defence', () => {
    let battle = heroUnderAttack([
      { from: { q: 1, r: 0 }, power: 2 },
      { from: { q: 0, r: 1 }, power: 1 },
    ]);
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    const after = heroDoes(battle, { kind: 'take-hit' }).battle;
    expect(after.creatures[0].hp).toBe(3);
    expect(after.turnWill).toBe(20);
  });

  it('keeps defend and act apart', () => {
    const battle = heroUnderAttack([{ from: { q: 1, r: 0 }, power: 1 }]);
    expect(rejectionOf(heroDoes(battle, { kind: 'move', hex: { q: -1, r: 0 } }).events)).toBe(
      'WRONG_PHASE',
    );
    const acting = heroDoes(battle, { kind: 'take-hit' }).battle;
    expect(rejectionOf(heroDoes(acting, { kind: 'take-hit' }).events)).toBe('WRONG_PHASE');
  });
});
