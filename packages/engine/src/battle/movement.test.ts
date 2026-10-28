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

function heroFirst(board = hexagonBoard(), heroAt = { q: 0, r: 0 }) {
  return giveTurn(battleWith([hero(heroAt), skeleton('s1', { q: 3, r: 0 })], board), [
    'hero',
    's1',
  ]);
}

describe('REQ-BTL-003 step prices', () => {
  it('charges 3 on floor, 5 on rubble, 5 to climb a ledge and 3 to come down', () => {
    let battle = heroFirst(hexagonBoard(3, { '-1,0': 'rubble', '0,-1': 'ledge' }));
    battle = heroDoes(battle, { kind: 'move', hex: { q: 1, r: 0 } }).battle;
    expect(battle.turnWill).toBe(17);
    battle = heroDoes(battle, { kind: 'move', hex: { q: 0, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'move', hex: { q: -1, r: 0 } }).battle;
    expect(battle.turnWill).toBe(9);

    let ledge = heroFirst(hexagonBoard(3, { '0,-1': 'ledge' }));
    ledge = heroDoes(ledge, { kind: 'move', hex: { q: 0, r: -1 } }).battle;
    expect(ledge.turnWill).toBe(15);
    ledge = heroDoes(ledge, { kind: 'move', hex: { q: 0, r: 0 } }).battle;
    expect(ledge.turnWill).toBe(12);
  });

  it('refuses walls, creatures, holes and hexes further than one step', () => {
    const battle = heroFirst(hexagonBoard(3, { '1,0': 'wall' }));
    expect(rejectionOf(heroDoes(battle, { kind: 'move', hex: { q: 1, r: 0 } }).events)).toBe(
      'HEX_BLOCKED',
    );
    expect(rejectionOf(heroDoes(battle, { kind: 'move', hex: { q: 2, r: 0 } }).events)).toBe(
      'NOT_ADJACENT',
    );

    const edge = heroFirst(hexagonBoard(), { q: 3, r: -1 });
    expect(rejectionOf(heroDoes(edge, { kind: 'move', hex: { q: 4, r: -1 } }).events)).toBe(
      'HEX_BLOCKED',
    );
    expect(rejectionOf(heroDoes(edge, { kind: 'move', hex: { q: 3, r: 0 } }).events)).toBe(
      'HEX_BLOCKED',
    );
  });

  it('refuses a step it cannot pay for and leaves the state untouched', () => {
    const battle = heroFirst();
    battle.turnWill = 2;
    const result = heroDoes(battle, { kind: 'move', hex: { q: 1, r: 0 } });
    expect(rejectionOf(result.events)).toBe('INSUFFICIENT_WILL');
    expect(result.events[0].payload).toMatchObject({ cost: 3, left: 2 });
    expect(result.battle).toBe(battle);
  });
});

describe('REQ-BTL-012 undo', () => {
  it('takes steps back one by one and returns their Will', () => {
    let battle = heroFirst(hexagonBoard(3, { '-1,0': 'rubble' }));
    battle = heroDoes(battle, { kind: 'move', hex: { q: -1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'move', hex: { q: -2, r: 0 } }).battle;
    expect(battle.turnWill).toBe(12);

    battle = heroDoes(battle, { kind: 'undo-step' }).battle;
    expect(battle.creatures[0].pos).toEqual({ q: -1, r: 0 });
    battle = heroDoes(battle, { kind: 'undo-step' }).battle;
    expect(battle.creatures[0].pos).toEqual({ q: 0, r: 0 });
    expect(battle.turnWill).toBe(20);
    expect(rejectionOf(heroDoes(battle, { kind: 'undo-step' }).events)).toBe('NOTHING_TO_UNDO');
  });

  it('forgets the steps once the hero strikes', () => {
    let battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), [
      'hero',
      's1',
    ]);
    battle = heroDoes(battle, { kind: 'move', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(battle.undo).toEqual([]);
    expect(rejectionOf(heroDoes(battle, { kind: 'undo-step' }).events)).toBe('NOTHING_TO_UNDO');
  });
});
