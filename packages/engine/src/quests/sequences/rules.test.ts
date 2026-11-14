import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../utils/random-seeded';
import { generateSequence } from './generate';
import { pickDecoys } from './decoys';
import {
  RULES,
  SequenceRuleSchema,
  continueFrom,
  termOf,
  termsOf,
  type RuleRegistry,
  type SequenceRule,
} from './rules';

describe('sequence rules', () => {
  it('REQ-QST-001: every kind gives the expected first 8 terms', () => {
    const cases: Array<[SequenceRule, number[]]> = [
      [{ kind: 'arith', start: 5, step: 5 }, [5, 10, 15, 20, 25, 30, 35, 40]],
      [{ kind: 'arith', start: 50, step: -3 }, [50, 47, 44, 41, 38, 35, 32, 29]],
      [{ kind: 'geom', start: 3, ratio: 2 }, [3, 6, 12, 24, 48, 96, 192, 384]],
      [{ kind: 'alternating', start: 1, steps: [2, 3] }, [1, 3, 6, 8, 11, 13, 16, 18]],
      [{ kind: 'growingStep', start: 1, step0: 1, inc: 1 }, [1, 2, 4, 7, 11, 16, 22, 29]],
    ];
    for (const [rule, expected] of cases) {
      expect(SequenceRuleSchema.safeParse(rule).success).toBe(true);
      expect(termsOf(rule, 8)).toEqual(expected);
      expect(termOf(rule, 3)).toBe(expected[2]);
    }
  });

  it('REQ-QST-005: a false trail continues the same recurrence from the wrong value', () => {
    expect(continueFrom({ kind: 'arith', start: 5, step: 5 }, 3, 16, 6)).toEqual([21, 26, 31]);
    expect(continueFrom({ kind: 'geom', start: 3, ratio: 2 }, 2, 7, 5)).toEqual([14, 28, 56]);
    expect(continueFrom({ kind: 'alternating', start: 1, steps: [2, 3] }, 3, 7, 5)).toEqual([
      9, 12,
    ]);
    expect(continueFrom({ kind: 'growingStep', start: 1, step0: 1, inc: 1 }, 3, 5, 5)).toEqual([
      8, 12,
    ]);
  });

  it('REQ-QST-005: the true value as the "wrong" one reproduces the true trail', () => {
    const rule: SequenceRule = { kind: 'growingStep', start: 2, step0: 2, inc: 1 };
    const terms = termsOf(rule, 9);
    expect(continueFrom(rule, 4, terms[3], 9)).toEqual(terms.slice(4));
  });

  it('REQ-QST-005: a wrong step at the very end has nothing to continue', () => {
    expect(continueFrom({ kind: 'arith', start: 1, step: 1 }, 10, 99, 10)).toEqual([]);
  });

  it('REQ-QST-020: a kind added only to the registry runs generate, continue and decoys', () => {
    interface DoubleAddRule {
      kind: 'doubleAdd';
      start: number;
      add: number;
    }
    const asRule = (rule: DoubleAddRule) => rule as unknown as SequenceRule;
    const registry: RuleRegistry = {
      ...RULES,
      doubleAdd: {
        params: ['start', 'add'],
        build: (v) => asRule({ kind: 'doubleAdd', start: v.start, add: v.add }),
        first: (r) => (r as unknown as DoubleAddRule).start,
        advance: (r, _i, value) => value * 2 + (r as unknown as DoubleAddRule).add,
        slips: (r, _i, value) => [value * 2 + (r as unknown as DoubleAddRule).add + 1],
      },
    };
    const request = {
      steps: 6,
      hintSteps: 3,
      maxDigits: 3,
      rulePool: [{ kind: 'doubleAdd', weight: 1, params: { start: [2, 3], add: 1 } }],
    };
    const generated = generateSequence(request, deriveStream('seed', 'rule'), registry);
    expect(generated.terms).toEqual(termsOf(generated.rule, 6, registry));
    expect(generated.terms[1]).toBe(generated.terms[0] * 2 + 1);

    const wrong = generated.terms[2] + 1;
    const tail = continueFrom(generated.rule, 3, wrong, 6, registry);
    expect(tail[0]).toBe(wrong * 2 + 1);

    const decoys = pickDecoys(
      {
        rule: generated.rule,
        step: 4,
        seen: generated.terms.slice(0, 3),
        next: generated.terms[3],
        after: generated.terms[4],
        length: 6,
        maxDigits: 3,
      },
      3,
      deriveStream('seed', 'decoys'),
      registry,
    );
    expect(decoys.length).toBeGreaterThan(0);
    expect(decoys).not.toContain(generated.terms[3]);
  });
});
