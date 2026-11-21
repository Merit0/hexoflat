import { upcastToken } from '../inventory/upcast-item-tokens';
import { battleStateSchema } from './battle-state';
import { battleHeroStats } from './hero-stats';
import { heroDoes } from './battle-test-setup';
import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { shieldCapacity } from './defend';
import { battleItem } from './battle-catalogue';
import {
  battleWith,
  hero,
  skeleton,
  giveTurn,
  strikeOpened,
  enemyDoes,
  hexagonBoard,
} from './battle-test-setup';

describe('A10 canonical block', () => {
  it('uses the canonical base for legacy hands and ignores the bag', () => {
    const actor = hero({ q: 0, r: 0 });
    actor.bag = [battleItem('king-shield')];
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(1);
    actor.hands.left = null;
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(0);
  });
  it('preserves full blocking of a stronger ledge strike', () => {
    const state = giveTurn(
      battleWith(
        [
          hero({ q: 0, r: 0 }),
          skeleton(
            'target',
            { q: 1, r: 0 },
            { hands: { right: null, left: battleItem('bone-buckler') } },
          ),
        ],
        hexagonBoard(3, { '0,0': 'ledge' }),
      ),
      ['hero', 'target'],
    );
    const pending = strikeOpened(state, 'hero', 'target');
    const raised = enemyDoes(
      pending,
      { kind: 'place-shield', hex: { q: 0, r: 0 } },
      'target',
    ).battle;
    expect(enemyDoes(raised, { kind: 'reaction-timeout' }, 'target').battle.creatures[1].hp).toBe(
      3,
    );
  });
});

function shield(value = 0) {
  return {
    key: 'wooden-shield',
    token: {
      ...upcastToken('hero', `shield-${value}`, 'shield')!,
      attributes: value ? [{ key: 'shield', value }] : [],
    },
  };
}

describe('A10 equipped Block attribute', () => {
  it.each([0, 1, 2, 9])('resolves base plus %s sides, capped at six', (value) => {
    const actor = hero({ q: 0, r: 0 });
    actor.hands.left = shield(value);
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(Math.min(6, 1 + value));
    expect(battleHeroStats(actor).blockSides).toBe(Math.min(6, 1 + value));
  });
  it('ignores the bag and requires a held shield even for a legacy bonus on armor', () => {
    const actor = hero({ q: 0, r: 0 });
    actor.bag = [shield(2)];
    actor.hands.left = null;
    actor.equipment = [{ key: 'armor', token: shield(2).token }];
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(0);
    actor.equipment = [];
    actor.hands.left = shield();
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(1);
  });
  it('sums two shields and refreshes immediately after replacement/removal and save/load', () => {
    const state = battleWith([hero({ q: 0, r: 0 }), skeleton('enemy', { q: 1, r: 0 })]);
    const actor = state.creatures[0];
    actor.hands = { right: shield(2), left: shield(2) };
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(6);
    actor.hands.left = shield(1);
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(5);
    actor.hands.right = null;
    expect(shieldCapacity(actor, BATTLE_RULES)).toBe(2);
    const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(shieldCapacity(loaded.creatures[0], BATTLE_RULES)).toBe(2);
    loaded.creatures[0].hands.left = null;
    expect(shieldCapacity(loaded.creatures[0], BATTLE_RULES)).toBe(0);
  });
  it('accepts the last permitted side and refuses one more without mutation', () => {
    const state = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('enemy', { q: 1, r: 0 })]), [
      'enemy',
      'hero',
    ]);
    state.creatures[0].hands.left = shield(1);
    let next = strikeOpened(state, 'enemy', 'hero');
    next = heroDoes(next, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    next = heroDoes(next, { kind: 'place-shield', hex: { q: 0, r: 1 } }).battle;
    const denied = heroDoes(next, { kind: 'place-shield', hex: { q: -1, r: 1 } });
    expect(denied.events).toContainEqual({
      type: 'BATTLE_REJECTED',
      payload: { rejected: 'SHIELD_CAPACITY_REACHED', action: 'place-shield' },
    });
    expect(denied.battle.placedShields).toEqual(next.placedShields);
  });
});
