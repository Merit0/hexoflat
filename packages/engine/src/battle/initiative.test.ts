import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../utils/random-seeded';
import { drawInitiative, orderByDraws } from './initiative';
import { battleWith, enemyTurn, giveTurn, hero, heroDoes, skeleton } from './battle-test-setup';

describe('REQ-BTL-001 initiative', () => {
  it('deals tokens 1..N without repeats', () => {
    const draws = drawInitiative(
      ['a', 'b', 'c', 'd'],
      createSeededRandom({ seed: 's', counter: 0 }),
    );
    expect(Object.values(draws).sort()).toEqual([1, 2, 3, 4]);
  });

  it('orders creatures from token 1 up, so the lowest token acts first', () => {
    expect(orderByDraws({ a: 2, b: 4, c: 1, d: 3 })).toEqual(['c', 'a', 'd', 'b']);
  });

  it('rolls at battle start and the first in order takes the turn', () => {
    const battle = battleWith([hero({ q: -2, r: 0 }), skeleton('s1', { q: 2, r: 0 })]);
    expect(battle.round).toBe(1);
    expect(Object.values(battle.draws).sort()).toEqual([1, 2]);
    expect(battle.activeId).toBe(battle.order[0]);
  });

  it('skips the fallen and draws again for the living every round', () => {
    const start = battleWith([
      hero({ q: -3, r: 0 }),
      skeleton('s1', { q: 3, r: 0 }, { hp: 0 }),
      skeleton('s2', { q: 3, r: -1 }),
    ]);
    let battle = giveTurn(start, ['hero', 's1', 's2']);
    battle = heroDoes(battle, { kind: 'end-turn' }).battle;
    expect(battle.activeId).toBe('s2');

    battle = enemyTurn(battle).battle;
    battle = heroDoes(battle, { kind: 'take-hit' }).battle;
    battle = enemyTurn(battle).battle;
    expect(battle.round).toBe(2);
    expect(Object.keys(battle.draws).sort()).toEqual(['hero', 's2']);
    expect(Object.values(battle.draws).sort()).toEqual([1, 2]);
  });
});
