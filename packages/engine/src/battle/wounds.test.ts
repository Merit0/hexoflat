import { describe, expect, it } from 'vitest';
import {
  battleWith,
  enemyDoes,
  enemyTurn,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  skeleton,
} from './battle-test-setup';

describe('REQ-BTL-017 shields only exist inside the block window', () => {
  const start = () =>
    giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), ['hero', 's1']);

  it('refuses a shield on the hero turn', () => {
    const { events } = heroDoes(start(), { kind: 'place-shield', hex: { q: 1, r: 0 } });
    expect(rejectionOf(events)).toBe('WRONG_PHASE');
  });

  it('never locks movement', () => {
    const { events } = heroDoes(start(), { kind: 'move', hex: { q: 0, r: 1 } });
    expect(eventTypes(events)).toEqual(['CREATURE_MOVED']);
  });
});

describe('REQ-BTL-021 wounds (where the hits landed)', () => {
  function struck(hexes: { q: number; r: number }[]) {
    let battle = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12 }),
        ...hexes.map((pos, i) => skeleton(`s${i + 1}`, pos)),
      ]),
      [...hexes.map((_, i) => `s${i + 1}`), 'hero'],
    );
    for (let i = 0; i < hexes.length; i++) {
      battle = enemyTurn(battle).battle;
      battle = heroDoes(battle, { kind: 'take-hit' }).battle;
      battle = enemyTurn(battle).battle;
    }
    return battle;
  }

  it('remembers the hex each landed hit came from', () => {
    const taken = struck([
      { q: 1, r: 0 },
      { q: -1, r: 0 },
    ]);
    expect(taken.wounds.hero).toEqual(
      expect.arrayContaining([
        { q: 1, r: 0 },
        { q: -1, r: 0 },
      ]),
    );
    expect(taken.wounds.hero).toHaveLength(2);
  });

  it('leaves no wound when the shield took the blow', () => {
    let battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
      's1',
      'hero',
    ]);
    battle = enemyTurn(battle).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: { q: 0, r: 1 } }).battle;
    const aiming = heroDoes(battle, { kind: 'reaction-timeout' }).battle;
    const blocked = enemyDoes(aiming, { kind: 'aim', hex: { q: 1, r: 0 } }).battle;
    expect(blocked.wounds.hero ?? []).toEqual([]);
  });

  it('forgets the wounds when a new round starts', () => {
    const taken = struck([{ q: 1, r: 0 }]);
    expect(taken.wounds.hero).toHaveLength(1);
    const later = heroDoes(taken, { kind: 'end-turn' }).battle;
    expect(later.round).toBe(2);
    expect(later.wounds).toEqual({});
  });
});
