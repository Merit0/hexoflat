import { resolveItemStats } from '../tokens/equipment/item-stats';
import type { DomainEvent } from '../commands/types';
import type { HeroStats } from '../tokens/equipment/hero-stats';
import { deriveStream } from '../utils/random-seeded';
import type { BattleRules } from './battle-content';
import type {
  BattleCreature,
  BattleHex,
  BattleItem,
  BattleState,
  PendingStrike,
} from './battle-state';
import {
  critResolverOf,
  type CritOutcome,
  type CritResolverId,
  type ICritResolver,
} from './crit-resolver';

export interface StrikeContext {
  state: BattleState;
  strike: PendingStrike;
  attacker: BattleCreature;
  target: BattleCreature;
  weapon: BattleItem | null;
  attackerStats: HeroStats;
  targetStats: HeroStats;
  fromHex: BattleHex;
  power: number;
  blocked: boolean;
  shields: BattleHex[];
  sweep?: boolean;
}

export interface StrikeResolution {
  critical: boolean;
  resolverId: CritResolverId;
  blocked: boolean;
  damageBeforeBlock: number;
  damageDealt: number;
}

export interface IStrikeDamage {
  resolve(ctx: StrikeContext, crit: CritOutcome): number;
}

export interface IStrikeBlock {
  resolve(ctx: StrikeContext, damage: number): number;
}

export interface IStrikeEffects {
  resolve(ctx: StrikeContext, result: StrikeResolution): DomainEvent[];
}

export class BaseStrikeDamage implements IStrikeDamage {
  constructor(private readonly critMultiplier: number) {}

  resolve(ctx: StrikeContext, crit: CritOutcome): number {
    const multiplier = Math.max(this.critMultiplier, resolveItemStats(ctx.weapon).critDamage);
    return ctx.power * (crit.critical ? multiplier : 1);
  }
}

export class FullStrikeBlock implements IStrikeBlock {
  resolve(ctx: StrikeContext, damage: number): number {
    return ctx.blocked ? 0 : damage;
  }
}

export class StrikeEvents implements IStrikeEffects {
  resolve(ctx: StrikeContext, result: StrikeResolution): DomainEvent[] {
    const { attacker, target, fromHex, strike, weapon } = ctx;
    if (ctx.sweep)
      return [
        {
          type: 'STRIKE_SWEPT',
          payload: {
            attackerId: attacker.id,
            victimId: target.id,
            fromHex,
            damage: result.damageDealt,
            ...result,
          },
        },
      ];
    return [
      {
        type: 'STRIKE_LANDED',
        payload: {
          attackerId: attacker.id,
          targetId: target.id,
          fromHex,
          itemKey: weapon?.key ?? 'unarmed',
          ring: strike.ring,
          ...result,
        },
      },
      {
        type: 'STRIKES_RESOLVED',
        payload: {
          creatureId: target.id,
          results: [
            {
              strikeId: strike.id,
              attackerId: attacker.id,
              fromHex,
              outcome: result.blocked ? 'blocked' : 'hit',
              damage: result.damageDealt,
              ...result,
            },
          ],
          burnedShields: ctx.shields,
        },
      },
    ];
  }
}

export interface StrikePipeline {
  crit: ICritResolver;
  damage: IStrikeDamage;
  block: IStrikeBlock;
  effects: IStrikeEffects;
}

export function critRatingOf(ctx: StrikeContext, rules: BattleRules): number {
  if (ctx.attacker.side !== 'heroes') return 0;
  return (
    rules.heroBaseCrit + resolveItemStats(ctx.weapon).critPoints + ctx.attackerStats.heroCritPoints
  );
}

export function resolveStrike(
  ctx: StrikeContext,
  rules: BattleRules,
  parts: StrikePipeline = {
    crit: critResolverOf(rules.critResolver),
    damage: new BaseStrikeDamage(rules.critMultiplier),
    block: new FullStrikeBlock(),
    effects: new StrikeEvents(),
  },
): { result: StrikeResolution; events: DomainEvent[] } {
  const suffix = ctx.sweep ? `:sweep:${ctx.target.id}` : '';
  const rng = deriveStream(ctx.state.seed, `combat:${ctx.strike.id}${suffix}:crit`);
  const rating = critRatingOf(ctx, rules);
  const crit = parts.crit.resolve({ rating, rng });
  const damageBeforeBlock = parts.damage.resolve(ctx, crit);
  const result: StrikeResolution = {
    critical: crit.critical,
    resolverId: parts.crit.id,
    blocked: ctx.blocked,
    damageBeforeBlock,
    damageDealt: parts.block.resolve(ctx, damageBeforeBlock),
  };
  return { result, events: parts.effects.resolve(ctx, result) };
}
