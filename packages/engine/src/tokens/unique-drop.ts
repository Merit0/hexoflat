import { z } from 'zod';
import type { RandomNumberGenerator } from '../utils/random';
import { uniqueKeySchema, type UniqueKey } from './token-keys';

const FRACTION = /^([1-9]\d*)\/([1-9]\d*)$/;

export interface Fraction {
  num: number;
  den: number;
}

export function parseChance(chance: string): Fraction | null {
  const match = FRACTION.exec(chance);
  if (!match) return null;
  const num = Number(match[1]);
  const den = Number(match[2]);
  return Number.isSafeInteger(num) && Number.isSafeInteger(den) && num <= den ? { num, den } : null;
}

export const uniqueChanceSchema = z
  .string()
  .refine((chance) => parseChance(chance) !== null, 'chance is a fraction "a/b" with 1 <= a <= b');

export const uniqueDropRuleSchema = z.strictObject({
  uniqueKey: uniqueKeySchema,
  chance: uniqueChanceSchema,
});
export type UniqueDropRule = z.infer<typeof uniqueDropRuleSchema>;

function fractionOf(rule: UniqueDropRule): Fraction {
  return parseChance(rule.chance) as Fraction;
}

function validTotal(rules: readonly UniqueDropRule[]): boolean {
  let num = 0n;
  let den = 1n;
  for (const rule of rules) {
    const fraction = parseChance(rule.chance);
    if (!fraction) return false;
    num = num * BigInt(fraction.den) + BigInt(fraction.num) * den;
    den *= BigInt(fraction.den);
    if (num > den) return false;
  }
  return true;
}

export const uniqueDropRulesSchema = z
  .array(uniqueDropRuleSchema)
  .max(1000)
  .refine((rules) => new Set(rules.map((rule) => rule.uniqueKey)).size === rules.length, {
    message: 'a unique is listed twice',
  })
  .refine((rules) => rules.length <= 1000 && validTotal(rules), {
    message: 'the chances add up to more than 1',
  });

export function resolveUniqueDrop(
  rules: readonly UniqueDropRule[],
  ownedUniques: readonly UniqueKey[],
  rng: RandomNumberGenerator,
): UniqueKey | null {
  const parsed = uniqueDropRulesSchema.parse(rules);
  const owned = new Set(ownedUniques);
  const roll = rng();
  let floor = 0;
  for (const rule of parsed) {
    if (owned.has(rule.uniqueKey)) continue;
    const { num, den } = fractionOf(rule);
    const ceiling = floor + num / den;
    if (roll < ceiling) return rule.uniqueKey;
    floor = ceiling;
  }
  return null;
}
