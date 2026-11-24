import { describe, expect, it } from 'vitest';
import { deriveStream } from '../utils/random-seeded';
import {
  parseChance,
  resolveUniqueDrop,
  uniqueDropRuleSchema,
  uniqueDropRulesSchema,
  type UniqueDropRule,
} from './unique-drop';

const SEEDS = Array.from({ length: 10_000 }, (_, index) => index + 1);
const TOLERANCE = 0.015;

function rngFor(seed: number) {
  return deriveStream(String(seed), 'test:unique-drop');
}

function rates(rules: UniqueDropRule[]) {
  const counts = new Map<string | null, number>();
  for (const seed of SEEDS) {
    const key = resolveUniqueDrop(rules, rngFor(seed));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (key: string | null) => (counts.get(key) ?? 0) / SEEDS.length;
}

describe('UniqueDropRule', () => {
  it('parses a chance written as a fraction', () => {
    expect(parseChance('1/20')).toEqual({ num: 1, den: 20 });
    expect(parseChance('3/3')).toEqual({ num: 3, den: 3 });
    for (const bad of ['0/5', '5/4', '0.05', '1/0', '1 / 20', '-1/20', '1/20/3']) {
      expect(parseChance(bad), bad).toBeNull();
      expect(uniqueDropRuleSchema.safeParse({ uniqueKey: 'a', chance: bad }).success).toBe(false);
    }
  });

  it('refuses a unique listed twice and chances above 1 in total', () => {
    const twice = [
      { uniqueKey: 'a', chance: '1/4' },
      { uniqueKey: 'a', chance: '1/4' },
    ];
    expect(uniqueDropRulesSchema.safeParse(twice).success).toBe(false);
    const over = [
      { uniqueKey: 'a', chance: '2/3' },
      { uniqueKey: 'b', chance: '1/2' },
    ];
    expect(uniqueDropRulesSchema.safeParse(over).success).toBe(false);
    const exact = [
      { uniqueKey: 'a', chance: '1/3' },
      { uniqueKey: 'b', chance: '1/3' },
      { uniqueKey: 'c', chance: '1/3' },
    ];
    expect(uniqueDropRulesSchema.safeParse(exact).success).toBe(true);
  });
});

describe('resolveUniqueDrop', () => {
  it.each(['1/20', '1/4', '1/2', '3/5'])(
    'drops a %s unique at its chance ±1.5 points over 10 000 seeds',
    (chance) => {
      const fraction = parseChance(chance);
      if (!fraction) throw new Error(chance);
      const rate = rates([{ uniqueKey: 'lantern-eater', chance }]);
      expect(Math.abs(rate('lantern-eater') - fraction.num / fraction.den)).toBeLessThanOrEqual(
        TOLERANCE,
      );
    },
  );

  it('gives every rule of a list its own chance', () => {
    const rules = [
      { uniqueKey: 'lantern-eater', chance: '1/20' },
      { uniqueKey: 'last-verdict', chance: '1/10' },
    ];
    const rate = rates(rules);
    expect(Math.abs(rate('lantern-eater') - 0.05)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(rate('last-verdict') - 0.1)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('Q5: the same unique can drop again', () => {
    const rules = [{ uniqueKey: 'lantern-eater', chance: '1/1' }];
    expect([1, 2, 3].map((seed) => resolveUniqueDrop(rules, rngFor(seed)))).toEqual([
      'lantern-eater',
      'lantern-eater',
      'lantern-eater',
    ]);
  });

  it('always drops a 1/1 unique, draws one number and repeats for the same seed', () => {
    let draws = 0;
    const counting = () => {
      draws += 1;
      return 0.999;
    };
    expect(resolveUniqueDrop([{ uniqueKey: 'a', chance: '1/1' }], counting)).toBe('a');
    expect(draws).toBe(1);
    const rules = [{ uniqueKey: 'a', chance: '1/3' }];
    for (const seed of SEEDS.slice(0, 100)) {
      expect(resolveUniqueDrop(rules, rngFor(seed))).toBe(resolveUniqueDrop(rules, rngFor(seed)));
    }
  });

  it('refuses broken rules', () => {
    expect(() => resolveUniqueDrop([{ uniqueKey: 'a', chance: '2/1' }], () => 0)).toThrow();
  });
});
