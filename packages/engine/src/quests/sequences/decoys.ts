import type { RandomNumberGenerator } from '../../utils/random';
import { matchingNexts } from './alternatives';
import {
  RULES,
  continueFrom,
  ruleKindOf,
  termsFitLimits,
  type RuleRegistry,
  type SequenceRule,
} from './rules';

export interface DecoyContext {
  rule: SequenceRule;
  step: number;
  seen: readonly number[];
  next: number;
  after: number | null;
  length: number;
  maxDigits: number;
}

export interface DecoyCandidates {
  close: number[];
  far: number[];
}

const NEAR = 1;
const FAR = 10;
const MIN_CLOSE = 2;

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

function isViable(ctx: DecoyContext, value: number, registry: RuleRegistry): boolean {
  if (!Number.isInteger(value) || value === ctx.next) return false;
  const continuation = continueFrom(ctx.rule, ctx.step, value, ctx.length, registry);
  return termsFitLimits([value, ...continuation], ctx.maxDigits);
}

export function decoyCandidates(
  ctx: DecoyContext,
  registry: RuleRegistry = RULES,
): DecoyCandidates {
  const blocked = new Set(matchingNexts(ctx.seen));
  const allowed = (values: number[]) =>
    unique(values).filter((value) => !blocked.has(value) && isViable(ctx, value, registry));
  const previous = ctx.seen.length > 0 ? ctx.seen[ctx.seen.length - 1] : null;
  const slips =
    previous === null ? [] : ruleKindOf(ctx.rule, registry).slips(ctx.rule, ctx.step - 1, previous);
  const close = allowed([
    ctx.next - NEAR,
    ctx.next + NEAR,
    ...(ctx.after === null ? [] : [ctx.after]),
  ]);
  const closeSet = new Set(close);
  const far = allowed([
    ctx.next - FAR,
    ctx.next + FAR,
    ...(previous === null ? [] : [previous]),
    ...slips,
  ]).filter((value) => !closeSet.has(value));
  return { close, far };
}

function shuffle<T>(items: T[], random: RandomNumberGenerator): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickDecoys(
  ctx: DecoyContext,
  count: number,
  random: RandomNumberGenerator,
  registry: RuleRegistry = RULES,
): number[] {
  const { close, far } = decoyCandidates(ctx, registry);
  const closeFirst = shuffle(close, random);
  const picked = closeFirst.slice(0, Math.min(MIN_CLOSE, count));
  const rest = shuffle([...closeFirst.slice(picked.length), ...far], random);
  return [...picked, ...rest].slice(0, count);
}
