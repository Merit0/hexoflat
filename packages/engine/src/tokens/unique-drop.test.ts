import { describe, expect, it } from 'vitest';
import { deriveStream } from '../utils/random-seeded';
import {
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
  it('D7: a chance is a whole number of basis points 0..10000', () => {
    for (const chanceBp of [0, 1, 50, 10_000]) {
      expect(uniqueDropRuleSchema.safeParse({ uniqueKey: 'a', chanceBp }).success).toBe(true);
    }
    for (const bad of [-1, 10_001, 0.5, Number.NaN, '50', '1/20', null]) {
      expect(
        uniqueDropRuleSchema.safeParse({ uniqueKey: 'a', chanceBp: bad }).success,
        String(bad),
      ).toBe(false);
    }
    expect(uniqueDropRuleSchema.safeParse({ uniqueKey: 'a', chance: '1/20' }).success).toBe(false);
  });

  it('refuses a unique listed twice and chances above 10000 basis points in total', () => {
    const twice = [
      { uniqueKey: 'a', chanceBp: 2500 },
      { uniqueKey: 'a', chanceBp: 2500 },
    ];
    expect(uniqueDropRulesSchema.safeParse(twice).success).toBe(false);
    const over = [
      { uniqueKey: 'a', chanceBp: 6667 },
      { uniqueKey: 'b', chanceBp: 5000 },
    ];
    expect(uniqueDropRulesSchema.safeParse(over).success).toBe(false);
    const exact = [
      { uniqueKey: 'a', chanceBp: 3333 },
      { uniqueKey: 'b', chanceBp: 3333 },
      { uniqueKey: 'c', chanceBp: 3333 },
    ];
    expect(uniqueDropRulesSchema.safeParse(exact).success).toBe(true);
  });
});

describe('resolveUniqueDrop', () => {
  it.each([500, 2500, 5000, 6000])(
    'drops a %s bp unique at its chance ±1.5 points over 10 000 seeds',
    (chanceBp) => {
      const rate = rates([{ uniqueKey: 'lantern-eater', chanceBp }]);
      expect(Math.abs(rate('lantern-eater') - chanceBp / 10_000)).toBeLessThanOrEqual(TOLERANCE);
    },
  );

  it('gives every rule of a list its own chance', () => {
    const rules = [
      { uniqueKey: 'lantern-eater', chanceBp: 500 },
      { uniqueKey: 'last-verdict', chanceBp: 1000 },
    ];
    const rate = rates(rules);
    expect(Math.abs(rate('lantern-eater') - 0.05)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(rate('last-verdict') - 0.1)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('Q5: the same unique can drop again', () => {
    const rules = [{ uniqueKey: 'lantern-eater', chanceBp: 10000 }];
    expect([1, 2, 3].map((seed) => resolveUniqueDrop(rules, rngFor(seed)))).toEqual([
      'lantern-eater',
      'lantern-eater',
      'lantern-eater',
    ]);
  });

  it('always drops a 10000 bp unique, draws one number and repeats for the same seed', () => {
    let draws = 0;
    const counting = () => {
      draws += 1;
      return 0.999;
    };
    expect(resolveUniqueDrop([{ uniqueKey: 'a', chanceBp: 10000 }], counting)).toBe('a');
    expect(draws).toBe(1);
    const rules = [{ uniqueKey: 'a', chanceBp: 3333 }];
    for (const seed of SEEDS.slice(0, 100)) {
      expect(resolveUniqueDrop(rules, rngFor(seed))).toBe(resolveUniqueDrop(rules, rngFor(seed)));
    }
  });

  it('refuses broken rules', () => {
    expect(() => resolveUniqueDrop([{ uniqueKey: 'a', chanceBp: 20_000 }], () => 0)).toThrow();
  });
});
