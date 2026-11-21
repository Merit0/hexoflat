import { describe, expect, it } from 'vitest';
import { sampleToken } from '../tokens/token-test-setup';
import { battleStateSchema } from './battle-state';
import { healBlockedStrike } from './heal-on-block';
import {
  battleWith,
  enemyDoes,
  giveTurn,
  hero,
  heroDoes,
  skeleton,
  strikeOpened,
} from './battle-test-setup';

function blocked() {
  const before = giveTurn(
    battleWith([hero({ q: 0, r: 0 }, { hp: 2 }), skeleton('enemy', { q: 1, r: 0 })]),
    ['enemy', 'hero'],
  );
  const opened = strikeOpened(before, 'enemy', 'hero');
  return heroDoes(opened, { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
}

describe('heal-on-block characterization', () => {
  it('an ordinary successful block prevents damage without healing or spending hero Will', () => {
    const before = blocked();
    const result = heroDoes(before, { kind: 'reaction-timeout' });
    const resolved =
      result.battle.reaction?.stage === 'aim'
        ? enemyDoes(result.battle, { kind: 'aim', hex: { q: 1, r: 0 } }, 'enemy')
        : result;
    expect(resolved.battle.creatures[0].hp).toBe(2);
    expect(resolved.battle.turnWill).toBe(before.reaction!.resume.turnWill);
    expect(resolved.events.some((event) => event.type === 'CREATURE_HEALED')).toBe(false);
    expect(before.creatures[0].hp).toBe(2);
  });
});

function withBonus(value: number) {
  const state = blocked();
  state.creatures[0].hands.left!.token = sampleToken({
    type: 'shield',
    name: { kind: 'noun', noun: 'shield' },
    attributes: [{ key: 'heal-on-block', value }],
  });
  return state;
}

function resolveBlock(state: ReturnType<typeof blocked>, hit = false) {
  const result = heroDoes(state, { kind: hit ? 'take-hit' : 'reaction-timeout' });
  return result.battle.reaction?.stage === 'aim'
    ? enemyDoes(result.battle, { kind: 'aim', hex: { q: 1, r: 0 } }, 'enemy')
    : result;
}

describe('shield healing on a successful block', () => {
  it.each([1, 2, 3, 4, 9])(
    'heals %s half-hearts, capped at four, once per blocked strike',
    (value) => {
      const before = withBonus(value);
      const result = resolveBlock(before);
      expect(result.battle.creatures[0].hp).toBe(2 + Math.min(4, value));
      expect(result.events.filter((event) => event.type === 'CREATURE_HEALED')).toEqual([
        {
          type: 'CREATURE_HEALED',
          payload: {
            creatureId: 'hero',
            healed: Math.min(4, value),
            hp: 2 + Math.min(4, value),
            source: 'heal-on-block',
          },
        },
      ]);
      expect(before.creatures[0].hp).toBe(2);
      const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(result.battle)));
      const repeated = heroDoes(loaded, { kind: 'reaction-timeout' });
      expect(repeated.battle.creatures[0].hp).toBe(result.battle.creatures[0].hp);
      expect(repeated.events.some((event) => event.type === 'CREATURE_HEALED')).toBe(false);
    },
  );

  it('clamps to maximum health and emits nothing when already full', () => {
    const state = withBonus(4);
    state.creatures[0].hp = 5;
    const result = resolveBlock(state);
    expect(result.battle.creatures[0].hp).toBe(6);
    expect(result.events.find((event) => event.type === 'CREATURE_HEALED')?.payload).toMatchObject({
      healed: 1,
    });
    state.creatures[0].hp = 6;
    expect(resolveBlock(state).events.some((event) => event.type === 'CREATURE_HEALED')).toBe(
      false,
    );
  });

  it('does not heal when taking a hit, removing shields or carrying the bonus in the bag', () => {
    const state = withBonus(4);
    expect(resolveBlock(state, true).battle.creatures[0].hp).toBe(0);
    const removed = heroDoes(state, { kind: 'remove-shield', hex: { q: 1, r: 0 } });
    expect(removed.battle.creatures[0].hp).toBe(2);
    state.creatures[0].bag.push(state.creatures[0].hands.left!);
    state.creatures[0].hands.left = { key: 'wooden-shield', shieldCapacity: 1 };
    expect(resolveBlock(state).battle.creatures[0].hp).toBe(2);
  });

  it('ignores a bonus on the weapon and saves the pending shield before resolution', () => {
    const state = withBonus(4);
    const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(resolveBlock(loaded).battle.creatures[0].hp).toBe(6);
    state.creatures[0].hands.right!.token = state.creatures[0].hands.left!.token;
    state.creatures[0].hands.left!.token = undefined;
    expect(resolveBlock(state).battle.creatures[0].hp).toBe(2);
  });

  it('does not heal enemies, dead targets or zero-power blocks and caps two shields together', () => {
    const actor = withBonus(4).creatures[0];
    const resolution = {
      blocked: true,
      damageBeforeBlock: 2,
      damageDealt: 0,
      critical: false,
      resolverId: 'rng-chance' as const,
    };
    actor.hands.right = structuredClone(actor.hands.left);
    expect(healBlockedStrike(actor, resolution)[0].payload).toMatchObject({ healed: 4 });
    actor.hp = 2;
    expect(healBlockedStrike(actor, { ...resolution, damageBeforeBlock: 0 })).toEqual([]);
    actor.side = 'enemies';
    expect(healBlockedStrike(actor, resolution)).toEqual([]);
    actor.side = 'heroes';
    actor.hp = 0;
    expect(healBlockedStrike(actor, resolution)).toEqual([]);
  });
});
