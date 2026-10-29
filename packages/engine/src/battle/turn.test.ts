import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleWith, giveTurn, hero, heroDoes, skeleton } from './battle-test-setup';
import { beginTurn } from './turn';

function strikeOnHero(battle: ReturnType<typeof battleWith>) {
  battle.pending.push({
    id: 'p1',
    attackerId: 's1',
    targetId: 'hero',
    fromHex: { q: 1, r: 0 },
    ring: [{ q: 1, r: 0 }],
    power: 1,
  });
}

describe('REQ-BTL-002 turn Will and stance', () => {
  it('starts every turn with 20 Will', () => {
    const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
      'hero',
      's1',
    ]);
    expect(battle.turnWill).toBe(BATTLE_RULES.willPerTurn);
    expect(battle.phase).toBe('act');
  });

  it('keeps at most 8 unspent Will as stance', () => {
    let battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
      'hero',
      's1',
    ]);
    battle = heroDoes(battle, { kind: 'end-turn' }).battle;
    expect(battle.stance.hero).toBe(8);

    battle = giveTurn(battle, ['hero', 's1']);
    battle.turnWill = 5;
    battle = heroDoes(battle, { kind: 'end-turn' }).battle;
    expect(battle.stance.hero).toBe(5);
  });

  it('adds the stance only when strikes are waiting, then trims Will back to 20', () => {
    const battle = battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    battle.stance.hero = 4;
    beginTurn(battle, 'hero', BATTLE_RULES);
    expect(battle.turnWill).toBe(20);
    expect(battle.stance.hero).toBeUndefined();

    battle.stance.hero = 4;
    strikeOnHero(battle);
    beginTurn(battle, 'hero', BATTLE_RULES);
    expect(battle.phase).toBe('defend');
    expect(battle.turnWill).toBe(24);

    const after = heroDoes(battle, { kind: 'take-hit' }).battle;
    expect(after.phase).toBe('act');
    expect(after.turnWill).toBe(20);
  });
});
