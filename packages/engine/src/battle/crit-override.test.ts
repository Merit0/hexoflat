import { describe, expect, it } from 'vitest';
import { BATTLE_RULES, battleRulesFailures } from './battle-content';
import { applyBattleFixture, battleFixtureSchema } from './battle-fixtures';
import { battleStateSchema, type BattleState } from './battle-state';
import { battleHeroStats } from './hero-stats';
import { battleWith, giveTurn, hero, heroDoes, skeleton } from './battle-test-setup';
import { critResolverOf } from './crit-resolver';
import { projectBattleForViewer } from './projection';
import { critRatingOf, type StrikeContext } from './strike-pipeline';

function fight(): BattleState {
  return giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
    'hero',
    's1',
  ]);
}

function strikeContext(state: BattleState): StrikeContext {
  const [attacker, target] = state.creatures;
  return {
    state,
    attacker,
    target,
    weapon: attacker.hands.right,
    attackerStats: battleHeroStats(attacker),
    targetStats: battleHeroStats(target),
    fromHex: attacker.pos,
    power: 2,
    blocked: false,
    shields: [],
    strike: {
      id: 'override:strike:1',
      attackerId: attacker.id,
      targetId: target.id,
      fromHex: attacker.pos,
      ring: [],
      power: 2,
    },
  };
}

function landed(state: BattleState): { critical?: boolean; damageDealt?: number } | undefined {
  const answer = heroDoes(state, { kind: 'strike', targetId: 's1', hand: 'right' });
  return answer.events.find((event) => event.type === 'STRIKE_LANDED')?.payload as
    { critical?: boolean; damageDealt?: number } | undefined;
}

describe('crit chance cap from BATTLE_RULES', () => {
  it('caps the resolved chance with critChanceCap', () => {
    const resolver = critResolverOf('rng-chance');
    expect(BATTLE_RULES.critChanceCap).toBe(25);
    expect(resolver.resolve({ rating: 40, cap: 25, rng: () => 0.5 }).detail.chance).toBe(25);
    expect(resolver.resolve({ rating: 40, cap: 10, rng: () => 0.5 }).detail.chance).toBe(10);
    expect(resolver.describe(40, BATTLE_RULES.critChanceCap).params).toEqual({ chance: 25 });
  });

  it('refuses a base chance above the cap', () => {
    expect(battleRulesFailures(BATTLE_RULES)).toEqual([]);
    expect(battleRulesFailures({ ...BATTLE_RULES, heroBaseCrit: 26 })).toEqual([
      'heroBaseCrit 26 is above critChanceCap 25',
    ]);
  });
});

describe('test override of the hero base crit chance', () => {
  it('is absent from a normally created battle, so BATTLE_RULES apply', () => {
    const state = fight();
    expect(state.critOverride).toBeUndefined();
    expect(critRatingOf(strikeContext(state), BATTLE_RULES)).toBe(BATTLE_RULES.heroBaseCrit);
  });

  it('is set only by the dev fixture and replaces only the base chance', () => {
    const source = fight();
    const next = applyBattleFixture(source, { kind: 'hero-base-crit', heroBaseCrit: 0 });
    expect(next.critOverride).toEqual({ heroBaseCrit: 0 });
    expect(source.critOverride).toBeUndefined();
    expect(critRatingOf(strikeContext(next), BATTLE_RULES)).toBe(0);
  });

  it('refuses a fixture value out of range or with extra fields', () => {
    expect(
      battleFixtureSchema.safeParse({ kind: 'hero-base-crit', heroBaseCrit: -1 }).success,
    ).toBe(false);
    expect(
      battleFixtureSchema.safeParse({ kind: 'hero-base-crit', heroBaseCrit: 0, cap: 0 }).success,
    ).toBe(false);
  });

  it('makes a real strike on a favourable roll non-critical, and the same roll crits without it', () => {
    const favourable = applyBattleFixture(fight(), { kind: 'crit-target' });
    expect(landed(favourable)).toMatchObject({ critical: true, damageDealt: 4 });
    const fixed = applyBattleFixture(favourable, { kind: 'hero-base-crit', heroBaseCrit: 0 });
    expect(landed(fixed)).toMatchObject({ critical: false, damageDealt: 2 });
  });

  it('survives a save and load, and an old battle without it still loads', () => {
    const fixed = applyBattleFixture(fight(), { kind: 'hero-base-crit', heroBaseCrit: 0 });
    const saved = battleStateSchema.parse(JSON.parse(JSON.stringify(fixed)));
    expect(saved.critOverride).toEqual({ heroBaseCrit: 0 });
    const old = battleStateSchema.parse(JSON.parse(JSON.stringify(fight())));
    expect(old.critOverride).toBeUndefined();
    expect(
      battleStateSchema.safeParse({ ...fixed, critOverride: { heroBaseCrit: 0, extra: 1 } })
        .success,
    ).toBe(false);
  });

  it('never reaches the client view', () => {
    const fixed = applyBattleFixture(fight(), { kind: 'hero-base-crit', heroBaseCrit: 0 });
    for (const viewer of ['heroes', 'enemies'] as const) {
      expect(projectBattleForViewer(fixed, viewer)).not.toHaveProperty('critOverride');
    }
  });
});
