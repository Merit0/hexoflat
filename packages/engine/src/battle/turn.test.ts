import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleWith, giveTurn, hero, heroDoes, skeleton } from './battle-test-setup';

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
});
