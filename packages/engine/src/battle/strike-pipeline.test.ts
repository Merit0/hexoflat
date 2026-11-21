import { describe, expect, it, vi } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleHeroStats } from './hero-stats';
import { critResolverOf, type CritContext } from './crit-resolver';
import { battleStateSchema } from './battle-state';
import { battleWith, enemyDoes, giveTurn, hero, skeleton, strikeOpened } from './battle-test-setup';
import {
  BaseStrikeDamage,
  FullStrikeBlock,
  resolveStrike,
  StrikeEvents,
  type StrikeContext,
} from './strike-pipeline';

function context(blocked: boolean): StrikeContext {
  const state = battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
  const [attacker, target] = state.creatures;
  return {
    state,
    attacker,
    target,
    weapon: attacker.hands.right,
    attackerStats: battleHeroStats(attacker),
    targetStats: battleHeroStats(target),
    strike: {
      id: 'b1:strike:1',
      attackerId: attacker.id,
      targetId: target.id,
      fromHex: attacker.pos,
      ring: [],
      power: 2,
    },
    fromHex: attacker.pos,
    power: 2,
    blocked,
    shields: blocked ? [attacker.pos] : [],
  };
}

describe('EA5 strike pipeline', () => {
  it.each([false, true])(
    'runs crit, damage, block and effects in order (blocked: %s)',
    (blocked) => {
      const order: string[] = [];
      const crit = critResolverOf('rng-chance');
      const damage = new BaseStrikeDamage();
      const block = new FullStrikeBlock();
      const effects = new StrikeEvents();
      const resolve = vi.fn((ctx: CritContext) => {
        order.push('crit');
        return crit.resolve(ctx);
      });
      const outcome = resolveStrike(context(blocked), BATTLE_RULES, {
        crit: { id: crit.id, describe: (rating) => crit.describe(rating), resolve },
        damage: {
          resolve: (ctx, critical) => {
            order.push('damage');
            return damage.resolve(ctx, critical);
          },
        },
        block: {
          resolve: (ctx, amount) => {
            order.push('block');
            return block.resolve(ctx, amount);
          },
        },
        effects: {
          resolve: (ctx, result) => {
            order.push('effects');
            return effects.resolve(ctx, result);
          },
        },
      });
      expect(order).toEqual(['crit', 'damage', 'block', 'effects']);
      expect(resolve.mock.calls[0][0].rating).toBe(0);
      expect(outcome.result).toEqual({
        critical: false,
        resolverId: 'rng-chance',
        blocked,
        damageBeforeBlock: 2,
        damageDealt: blocked ? 0 : 2,
      });
      expect(outcome.events[0].payload).toMatchObject(outcome.result);
      expect(outcome.events[1].payload).toMatchObject({ results: [outcome.result] });
    },
  );

  it('resolves a saved block window identically and records the result without needing a new roll for playback', () => {
    const start = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
      'hero',
      's1',
    ]);
    const pending = strikeOpened(start, 'hero', 's1');
    const restored = battleStateSchema.parse(JSON.parse(JSON.stringify(pending)));
    const run = (state: typeof pending) => enemyDoes(state, { kind: 'take-hit' }, 's1');
    expect(run(restored)).toEqual(run(pending));
    const event = run(restored).events.find((entry) => entry.type === 'STRIKE_LANDED')!;
    const recorded = JSON.parse(JSON.stringify(event)) as typeof event;
    expect(recorded.payload).toMatchObject({
      critical: false,
      resolverId: 'rng-chance',
      blocked: false,
      damageBeforeBlock: 2,
      damageDealt: 2,
    });
  });
});
