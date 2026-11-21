import { z } from 'zod';
import type { DescriptionLine } from '../tokens/token-schema';
import type { RandomNumberGenerator } from '../utils/random';

export const critResolverIdSchema = z.enum(['rng-chance', 'dice', 'counter', 'math']);
export type CritResolverId = z.infer<typeof critResolverIdSchema>;

export interface CritContext {
  rating: number;
  rng: RandomNumberGenerator;
}

export interface CritOutcome {
  critical: boolean;
  detail: Record<string, string | number | boolean>;
}

export interface ICritResolver {
  readonly id: CritResolverId;
  resolve(ctx: CritContext): CritOutcome;
  describe(rating: number): DescriptionLine;
}

function chanceOf(rating: number): number {
  return Math.max(0, Math.min(25, rating));
}

export class RngChanceCritResolver implements ICritResolver {
  readonly id = 'rng-chance';

  resolve(ctx: CritContext): CritOutcome {
    const chance = chanceOf(ctx.rating);
    const roll = ctx.rng();
    return { critical: roll < chance / 100, detail: { rating: ctx.rating, chance, roll } };
  }

  describe(rating: number): DescriptionLine {
    return { key: 'content.battle.crit.chance', params: { chance: chanceOf(rating) } };
  }
}

export const CRIT_RESOLVERS: readonly ICritResolver[] = [new RngChanceCritResolver()];

export function critResolverOf(id: CritResolverId): ICritResolver {
  const resolver = CRIT_RESOLVERS.find((candidate) => candidate.id === id);
  if (!resolver) throw new Error(`Unknown crit resolver: ${id}`);
  return resolver;
}
