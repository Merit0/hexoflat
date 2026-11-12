import { z } from 'zod';

const IntSchema = z.number().int();

export const ArithRuleSchema = z.object({
  kind: z.literal('arith'),
  start: IntSchema,
  step: IntSchema.refine((n) => n !== 0),
});

export const GeomRuleSchema = z.object({
  kind: z.literal('geom'),
  start: IntSchema,
  ratio: IntSchema.min(2),
});

export const AlternatingRuleSchema = z.object({
  kind: z.literal('alternating'),
  start: IntSchema,
  steps: z.tuple([IntSchema, IntSchema]),
});

export const GrowingStepRuleSchema = z.object({
  kind: z.literal('growingStep'),
  start: IntSchema,
  step0: IntSchema.min(1),
  inc: IntSchema.min(1),
});

export const SequenceRuleSchema = z.discriminatedUnion('kind', [
  ArithRuleSchema,
  GeomRuleSchema,
  AlternatingRuleSchema,
  GrowingStepRuleSchema,
]);

export type SequenceRule = z.infer<typeof SequenceRuleSchema>;
export type SequenceRuleKind = SequenceRule['kind'];

export const ParamSpecSchema = z.union([
  IntSchema,
  z.object({ min: IntSchema, max: IntSchema }).refine((r) => r.min <= r.max),
  z.array(IntSchema).min(1),
]);
export type ParamSpec = z.infer<typeof ParamSpecSchema>;

export const RulePoolEntrySchema = z
  .object({
    kind: z.string().min(1),
    weight: IntSchema.min(1).default(1),
    params: z.record(z.string(), ParamSpecSchema),
  })
  .strict();
export type RulePoolEntry = z.infer<typeof RulePoolEntrySchema>;

export interface RuleKind {
  readonly params: readonly string[];
  build(values: Readonly<Record<string, number>>): SequenceRule | null;
  first(rule: SequenceRule): number;
  advance(rule: SequenceRule, index: number, value: number): number;
  slips(rule: SequenceRule, index: number, value: number): number[];
}

export type RuleRegistry = Readonly<Record<string, RuleKind>>;

type RuleOf<K extends SequenceRuleKind> = Extract<SequenceRule, { kind: K }>;

interface RuleKindDefinition<K extends SequenceRuleKind> {
  params: readonly string[];
  build(values: Readonly<Record<string, number>>): RuleOf<K> | null;
  first(rule: RuleOf<K>): number;
  advance(rule: RuleOf<K>, index: number, value: number): number;
  slips(rule: RuleOf<K>, index: number, value: number): number[];
}

function defineKind<K extends SequenceRuleKind>(definition: RuleKindDefinition<K>): RuleKind {
  return definition;
}

export const RULES: RuleRegistry = {
  arith: defineKind<'arith'>({
    params: ['start', 'step'],
    build: (v) => (v.step === 0 ? null : { kind: 'arith', start: v.start, step: v.step }),
    first: (r) => r.start,
    advance: (r, _i, value) => value + r.step,
    slips: (r, _i, value) => [value + r.step + 1, value + r.step - 1],
  }),
  geom: defineKind<'geom'>({
    params: ['start', 'ratio'],
    build: (v) => (v.ratio < 2 ? null : { kind: 'geom', start: v.start, ratio: v.ratio }),
    first: (r) => r.start,
    advance: (r, _i, value) => value * r.ratio,
    slips: (r, _i, value) => [value + r.ratio, value * (r.ratio + 1)],
  }),
  alternating: defineKind<'alternating'>({
    params: ['start', 'stepA', 'stepB'],
    build: (v) =>
      v.stepA === v.stepB
        ? null
        : { kind: 'alternating', start: v.start, steps: [v.stepA, v.stepB] },
    first: (r) => r.start,
    advance: (r, i, value) => value + r.steps[(i - 1) % 2],
    slips: (r, i, value) => [value + r.steps[i % 2], value + r.steps[(i - 1) % 2] + 1],
  }),
  growingStep: defineKind<'growingStep'>({
    params: ['start', 'step0', 'inc'],
    build: (v) =>
      v.step0 < 1 || v.inc < 1
        ? null
        : { kind: 'growingStep', start: v.start, step0: v.step0, inc: v.inc },
    first: (r) => r.start,
    advance: (r, i, value) => value + r.step0 + (i - 1) * r.inc,
    slips: (r, i, value) => [value + r.step0 + (i - 2) * r.inc, value + r.step0 + i * r.inc],
  }),
};

export function ruleKindOf(rule: { kind: string }, registry: RuleRegistry = RULES): RuleKind {
  const kind = registry[rule.kind];
  if (!kind) throw new Error(`UNKNOWN_RULE_KIND:${rule.kind}`);
  return kind;
}

export function termsOf(
  rule: SequenceRule,
  count: number,
  registry: RuleRegistry = RULES,
): number[] {
  const kind = ruleKindOf(rule, registry);
  const terms: number[] = [];
  let value = kind.first(rule);
  for (let index = 1; index <= count; index += 1) {
    terms.push(value);
    value = kind.advance(rule, index, value);
  }
  return terms;
}

export function termOf(rule: SequenceRule, index: number, registry: RuleRegistry = RULES): number {
  return termsOf(rule, index, registry)[index - 1];
}

export function continueFrom(
  rule: SequenceRule,
  step: number,
  wrongValue: number,
  count: number,
  registry: RuleRegistry = RULES,
): number[] {
  const kind = ruleKindOf(rule, registry);
  const values: number[] = [];
  let value = wrongValue;
  for (let index = step; index < count; index += 1) {
    value = kind.advance(rule, index, value);
    values.push(value);
  }
  return values;
}

export function termsFitLimits(terms: readonly number[], maxDigits: number): boolean {
  const limit = 10 ** maxDigits - 1;
  return terms.every((term) => Number.isInteger(term) && term > 0 && term <= limit);
}
