import { uniqueAvailableInDimension } from '../dimensions/availability';
import type { EDimension } from '../dimensions/dimensions';
import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import type { UniqueTokenContent } from './unique-schema';
import { z } from 'zod';
import type { RandomNumberGenerator } from '../utils/random';
import { BASIS_POINTS, basisPointsSchema, uniqueKeySchema, type UniqueKey } from './token-keys';

export const uniqueDropRuleSchema = z.strictObject({
  uniqueKey: uniqueKeySchema,
  chanceBp: basisPointsSchema,
});
export type UniqueDropRule = z.infer<typeof uniqueDropRuleSchema>;

function totalChance(rules: readonly UniqueDropRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.chanceBp, 0);
}

export const uniqueDropRulesSchema = z
  .array(uniqueDropRuleSchema)
  .max(1000)
  .refine((rules) => new Set(rules.map((rule) => rule.uniqueKey)).size === rules.length, {
    message: 'a unique is listed twice',
  })
  .refine((rules) => totalChance(rules) <= BASIS_POINTS, {
    message: 'the chances add up to more than 10000 basis points',
  });

export function resolveUniqueDrop(
  rules: readonly UniqueDropRule[],
  rng: RandomNumberGenerator,
  scope?: { dimension: EDimension; definitions?: readonly UniqueTokenContent[] },
): UniqueKey | null {
  const parsed = uniqueDropRulesSchema.parse(rules).filter((rule) => {
    if (!scope) return true;
    const definition = (scope.definitions ?? TOKEN_UNIQUES).find(
      (entry) => entry.key === rule.uniqueKey,
    );
    if (!definition) throw new Error(`UNKNOWN_UNIQUE_DROP: ${rule.uniqueKey}`);
    return uniqueAvailableInDimension(definition, scope.dimension);
  });
  const roll = Math.floor(rng() * BASIS_POINTS);
  let ceiling = 0;
  for (const rule of parsed) {
    ceiling += rule.chanceBp;
    if (roll < ceiling) return rule.uniqueKey;
  }
  return null;
}
