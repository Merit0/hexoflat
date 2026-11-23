import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import { itemTokenSchema } from '../tokens/token-schema';
import { sampleToken } from '../tokens/token-test-setup';
import { BATTLE_RULES, type BattleRules } from './battle-content';
import { battleHeroStats } from './hero-stats';
import { battleWith, hero, NO_BASE_CRIT_RULES, skeleton } from './battle-test-setup';
import type { CritContext, CritOutcome, ICritResolver } from './crit-resolver';
import {
  BaseStrikeDamage,
  FullStrikeBlock,
  resolveStrike,
  StrikeEvents,
  type StrikeContext,
} from './strike-pipeline';

const NO_BASE = NO_BASE_CRIT_RULES;
const STRIKES = 2000;

function context(attributes: { key: string; value: number }[] = []): StrikeContext {
  const attacker = hero({ q: 0, r: 0 });
  attacker.hands.right!.token = sampleToken({ attributes });
  const target = skeleton('target', { q: 1, r: 0 }, { hp: 30, maxHp: 30 });
  return {
    state: battleWith([attacker, target]),
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
      id: 'base-crit:strike:0',
      attackerId: attacker.id,
      targetId: target.id,
      fromHex: attacker.pos,
      ring: [],
      power: 2,
    },
  };
}

function ratingOf(ctx: StrikeContext, rules: BattleRules): number {
  const ratings: number[] = [];
  const spy: ICritResolver = {
    id: 'rng-chance',
    resolve(crit: CritContext): CritOutcome {
      ratings.push(crit.rating);
      return { critical: false, detail: {} };
    },
    describe: () => ({ key: 'content.battle.crit.chance', params: {} }),
  };
  resolveStrike(ctx, rules, {
    crit: spy,
    damage: new BaseStrikeDamage(rules.critMultiplier),
    block: new FullStrikeBlock(),
    effects: new StrikeEvents(),
  });
  return ratings[0];
}

function criticalStrikes(ctx: StrikeContext, rules: BattleRules): number[] {
  const damages: number[] = [];
  for (let index = 0; index < STRIKES; index++) {
    ctx.strike.id = `base-crit:strike:${index}`;
    const { result } = resolveStrike(ctx, rules);
    if (result.critical) damages.push(result.damageDealt);
  }
  return damages;
}

describe('crit rating characterization (before the hero base chance)', () => {
  it('reads only the weapon crit chance for a hero', () => {
    expect(ratingOf(context([{ key: 'crit-chance', value: 7 }]), NO_BASE)).toBe(7);
    expect(ratingOf(context(), NO_BASE)).toBe(0);
  });

  it('gives an enemy rating 0 even with a crit weapon', () => {
    const ctx = context([{ key: 'crit-chance', value: 10 }]);
    ctx.attacker.side = 'enemies';
    expect(ratingOf(ctx, BATTLE_RULES)).toBe(0);
  });

  it('multiplies a critical strike by x2 by default', () => {
    expect(BATTLE_RULES.critMultiplier).toBe(2);
    const damages = criticalStrikes(context([{ key: 'crit-chance', value: 10 }]), NO_BASE);
    expect(damages.length).toBeGreaterThan(0);
    expect(new Set(damages)).toEqual(new Set([4]));
  });
});

describe('AG4 hero base crit chance', () => {
  it('reads the base chance from content', () => {
    expect(BATTLE_RULES.heroBaseCrit).toBe(5);
    expect(ratingOf(context(), BATTLE_RULES)).toBe(5);
    expect(ratingOf(context([{ key: 'crit-chance', value: 7 }]), BATTLE_RULES)).toBe(12);
  });

  it('AG4-1: a sword with only crit-dmg x3 crits with the base chance and deals power x3', () => {
    const damages = criticalStrikes(context([{ key: 'crit-dmg', value: 3 }]), BATTLE_RULES);
    expect(damages.length).toBeGreaterThan(0);
    expect(new Set(damages)).toEqual(new Set([6]));
  });

  it('AG4-2: base 0 and no crit attribute never crit', () => {
    expect(criticalStrikes(context(), NO_BASE)).toEqual([]);
    expect(criticalStrikes(context([{ key: 'crit-dmg', value: 3 }]), NO_BASE)).toEqual([]);
  });

  it('AG4-3: base 5 + weapon 10 + hero gear 15 is capped at 25', () => {
    const ctx = context([{ key: 'crit-chance', value: 10 }]);
    ctx.attackerStats = { ...ctx.attackerStats, heroCritPoints: 15 };
    expect(ratingOf(ctx, BATTLE_RULES)).toBe(30);
    const critical = criticalStrikes(ctx, BATTLE_RULES).length;
    expect(Math.abs((critical / STRIKES) * 100 - 25)).toBeLessThan(3);
    const detail = resolveStrike(ctx, BATTLE_RULES);
    expect(detail.result.resolverId).toBe('rng-chance');
  });

  it('AG4-3: adds hero-scoped crit points from the attacker stats', () => {
    const ctx = context();
    ctx.attackerStats = { ...ctx.attackerStats, heroCritPoints: 4 };
    expect(ratingOf(ctx, BATTLE_RULES)).toBe(9);
  });

  it('AG4-4: enemy strikes never crit', () => {
    const ctx = context([
      { key: 'crit-chance', value: 10 },
      { key: 'crit-dmg', value: 5 },
    ]);
    ctx.attacker.side = 'enemies';
    ctx.attackerStats = { ...ctx.attackerStats, heroCritPoints: 25 };
    expect(ratingOf(ctx, BATTLE_RULES)).toBe(0);
    expect(criticalStrikes(ctx, BATTLE_RULES)).toEqual([]);
  });
});

describe('AG4 split crit stat keeps stored tokens', () => {
  it('reads a stored hero-crit line by key into heroCritPoints without a migration', () => {
    const stored: unknown = JSON.parse(
      JSON.stringify(sampleToken({ attributes: [{ key: 'hero-crit', value: 4 }] })),
    );
    const token = itemTokenSchema.parse(stored);
    expect(token.attributes).toEqual([{ key: 'hero-crit', value: 4 }]);
    const attributes = EQUIPMENT_ATTRIBUTES.map((attribute) =>
      attribute.key === 'hero-crit' ? { ...attribute, implemented: true } : attribute,
    );
    const stats = resolveHeroStats([{ key: 'sword', token }], {
      attributes,
      types: EQUIPMENT_TYPES,
    });
    expect(stats.heroCritPoints).toBe(4);
    expect(stats.critPoints).toBe(0);
    expect(resolveHeroStats([{ key: 'sword', token }]).heroCritPoints).toBe(0);
  });
});
