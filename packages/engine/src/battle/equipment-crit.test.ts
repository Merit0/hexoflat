import { describe, expect, it } from 'vitest';
import { sampleToken } from '../tokens/token-test-setup';
import { BATTLE_RULES } from './battle-content';
import { battleHeroStats } from './hero-stats';
import {
  battleWith,
  hero,
  skeleton,
  giveTurn,
  heroDoes,
  NO_BASE_CRIT_RULES,
} from './battle-test-setup';
import { battleStateSchema } from './battle-state';
import { resolveStrike, type StrikeContext } from './strike-pipeline';

function context(chance = 10, multiplier = 0): StrikeContext {
  const attacker = hero({ q: 0, r: 0 });
  attacker.hands.right!.token = sampleToken({
    attributes: [
      { key: 'crit-chance', value: chance },
      ...(multiplier ? [{ key: 'crit-dmg', value: multiplier }] : []),
    ],
  });
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
      id: 'crit:strike:1',
      attackerId: attacker.id,
      targetId: target.id,
      fromHex: attacker.pos,
      ring: [],
      power: 2,
    },
  };
}

function favourable(ctx: StrikeContext): StrikeContext {
  for (let index = 0; index < 1000; index++) {
    ctx.strike.id = `crit:strike:${index}`;
    if (resolveStrike(ctx, BATTLE_RULES).result.critical) return ctx;
  }
  throw new Error('No critical roll');
}

describe('weapon critical strikes', () => {
  it.each([2, 3, 4, 5])('multiplies only critical damage by x%s', (multiplier) => {
    const ctx = favourable(context(10, multiplier));
    expect(resolveStrike(ctx, BATTLE_RULES).result).toMatchObject({
      critical: true,
      damageBeforeBlock: 2 * multiplier,
      damageDealt: 2 * multiplier,
    });
    ctx.weapon!.token!.attributes = [{ key: 'crit-dmg', value: multiplier }];
    expect(resolveStrike(ctx, NO_BASE_CRIT_RULES).result).toMatchObject({
      critical: false,
      damageBeforeBlock: 2,
      damageDealt: 2,
    });
  });

  it('defaults to x2 and caps owned multipliers at x5', () => {
    expect(resolveStrike(favourable(context()), BATTLE_RULES).result.damageDealt).toBe(4);
    expect(resolveStrike(favourable(context(99, 99)), BATTLE_RULES).result.damageDealt).toBe(10);
  });

  it('rolls before a full block and records the multiplied damage', () => {
    const ctx = favourable(context(10, 5));
    ctx.blocked = true;
    const result = resolveStrike(ctx, BATTLE_RULES);
    expect(result.result).toMatchObject({ critical: true, damageBeforeBlock: 10, damageDealt: 0 });
    expect(result.events[0].payload).toMatchObject(result.result);
  });

  it('ignores bag gear, the other hand, hero attributes and enemy weapon crit', () => {
    const ctx = favourable(context());
    const bonus = ctx.weapon!;
    ctx.attacker.hands.left = bonus;
    ctx.attacker.bag = [bonus];
    ctx.attackerStats.critPoints = 25;
    ctx.weapon = { key: 'unarmed', power: 1 };
    expect(resolveStrike(ctx, NO_BASE_CRIT_RULES).result.critical).toBe(false);
    ctx.weapon = bonus;
    ctx.attacker.side = 'enemies';
    expect(resolveStrike(ctx, NO_BASE_CRIT_RULES).result.critical).toBe(false);
  });

  it.each([2, 10, 99])('10 000 rolls follow %s percent, capped at 10', (rating) => {
    const ctx = context(rating);
    let critical = 0;
    for (let index = 0; index < 10_000; index++) {
      ctx.strike.id = `frequency:strike:${index}`;
      ctx.blocked = index % 2 === 0;
      if (resolveStrike(ctx, NO_BASE_CRIT_RULES).result.critical) critical++;
    }
    expect(Math.abs(critical / 100 - Math.min(10, rating))).toBeLessThan(1);
  });

  it('keeps sweeps deterministic with separate victim streams', () => {
    const ctx = context(10, 5);
    ctx.sweep = true;
    const results = new Set<boolean>();
    for (let index = 0; index < 100; index++) {
      ctx.target.id = `victim-${index}`;
      const result = resolveStrike(ctx, BATTLE_RULES);
      expect(resolveStrike(ctx, BATTLE_RULES)).toEqual(result);
      expect(result.events[0].type).toBe('STRIKE_SWEPT');
      results.add(result.result.critical);
    }
    expect(results.size).toBe(2);
  });

  it('replays a real critical command after save/load without changing its outcome', () => {
    const ctx = context(10, 5);
    ctx.target.hands = { right: null, left: null };
    const state = giveTurn(ctx.state, ['hero', 'target']);
    for (let index = 0; index < 1000; index++) {
      state.strikeSeq = index;
      const run = (input: typeof state) =>
        heroDoes(input, { kind: 'strike', targetId: 'target', hand: 'right' });
      const answer = run(state);
      const landed = answer.events.find((event) => event.type === 'STRIKE_LANDED');
      if (!(landed?.payload as { critical?: boolean } | undefined)?.critical) continue;
      expect(run(battleStateSchema.parse(JSON.parse(JSON.stringify(state))))).toEqual(answer);
      expect(answer.battle.creatures[1].hp).toBe(20);
      expect(state.creatures[1].hp).toBe(30);
      return;
    }
    throw new Error('No critical command');
  });
});
