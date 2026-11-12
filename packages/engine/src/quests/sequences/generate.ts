import type { RandomNumberGenerator } from '../../utils/random';
import { hintStepsFor } from './alternatives';
import {
  RULES,
  ruleKindOf,
  termsFitLimits,
  termsOf,
  type ParamSpec,
  type RulePoolEntry,
  type RuleRegistry,
  type SequenceRule,
} from './rules';

export interface SequenceRequest {
  steps: number;
  hintSteps: number;
  maxDigits: number;
  rulePool: readonly RulePoolEntry[];
}

export interface GeneratedSequence {
  rule: SequenceRule;
  terms: number[];
  hintSteps: number;
}

const MAX_ATTEMPTS = 500;

function pickInt(min: number, max: number, random: RandomNumberGenerator): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function sampleParam(spec: ParamSpec, random: RandomNumberGenerator): number {
  if (typeof spec === 'number') return spec;
  if (Array.isArray(spec)) return spec[Math.floor(random() * spec.length)];
  return pickInt(spec.min, spec.max, random);
}

function pickEntry(pool: readonly RulePoolEntry[], random: RandomNumberGenerator): RulePoolEntry {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return pool[pool.length - 1];
}

function sampleRule(
  entry: RulePoolEntry,
  random: RandomNumberGenerator,
  registry: RuleRegistry,
): SequenceRule | null {
  const kind = ruleKindOf(entry, registry);
  const values: Record<string, number> = {};
  for (const name of kind.params) {
    const spec = entry.params[name];
    if (spec === undefined) return null;
    values[name] = sampleParam(spec, random);
  }
  return kind.build(values);
}

export function generateSequence(
  request: SequenceRequest,
  random: RandomNumberGenerator,
  registry: RuleRegistry = RULES,
): GeneratedSequence {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const rule = sampleRule(pickEntry(request.rulePool, random), random, registry);
    if (!rule) continue;
    const terms = termsOf(rule, request.steps, registry);
    if (!termsFitLimits(terms, request.maxDigits)) continue;
    const hintSteps = hintStepsFor(terms, request.hintSteps);
    if (hintSteps !== null) return { rule, terms, hintSteps };
  }
  throw new Error('SEQUENCE_GENERATION_FAILED');
}
