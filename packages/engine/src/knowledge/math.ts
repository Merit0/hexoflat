import { createSeededRandom } from '../utils/random-seeded';
import type { RandomNumberGenerator } from '../utils/random';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { terrainStepCost, type TerrainId } from '../boards/terrain';
import { willZoneCharges, type WillZoneContext } from './will-zone';

/** Candidate balance; deliberately separate from progression and equipment. */
export const KNOWLEDGE_RULES = {
  startingWill: 20,
  capacity: 50,
  questionCount: 20,
  returnMinCorrect: 17,
  hallAnswerReward: 1,
  hallFastReward: 2,
  hallFastAnswerMs: 4000,
  hallRecentFacts: 8,
  worldStepCost: 1,
  assistedFailures: 2,
  reviewCount: 10,
} as const;

export interface MathQuestion {
  id: string;
  operation: 'multiply' | 'divide';
  lhs: number;
  rhs: number;
  answer: number;
  options: number[];
  factKey: string;
}

function shuffle<T>(items: T[], rng: RandomNumberGenerator): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function factPool(operation: MathQuestion['operation']): Omit<MathQuestion, 'id' | 'options'>[] {
  const pool: Omit<MathQuestion, 'id' | 'options'>[] = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      if (operation === 'multiply' && b < a) continue;
      const lhs = operation === 'multiply' ? a : a * b;
      const answer = operation === 'multiply' ? a * b : b;
      pool.push({
        operation,
        lhs,
        rhs: a === lhs ? b : a,
        answer,
        factKey: `${operation}:${lhs}:${operation === 'multiply' ? b : a}`,
      });
    }
  }
  return pool;
}

function choices(answer: number, rhs: number, rng: RandomNumberGenerator): number[] {
  const candidates = shuffle(
    [
      ...new Set([answer - rhs, answer + rhs, answer - 1, answer + 1, answer + 2, answer + 3]),
    ].filter((n) => n > 0 && n !== answer),
    rng,
  );
  return shuffle([answer, ...candidates.slice(0, 3)], rng);
}

export function generateQuestions(
  seed: string,
  history: Record<string, boolean[]> = {},
): MathQuestion[] {
  const rng = createSeededRandom({ seed, counter: 0 });
  const pools = {
    multiply: selectFacts('multiply', rng, history),
    divide: selectFacts('divide', rng, history),
  };
  // Choose randomly among feasible prefixes, so neither operation runs over two.
  const result: MathQuestion[] = [];
  while (result.length < KNOWLEDGE_RULES.questionCount) {
    const last = result.at(-1)?.operation;
    const repeated = last && result.at(-2)?.operation === last;
    const available = (['multiply', 'divide'] as const).filter((op) => {
      if (!pools[op].length || (repeated && op === last)) return false;
      const other = op === 'multiply' ? 'divide' : 'multiply';
      return pools[other].length <= 2 * pools[op].length;
    });
    const operation = available[Math.floor(rng() * available.length)];
    const fact = pools[operation].pop()!;
    result.push({
      ...fact,
      id: `${seed}:${result.length}`,
      options: choices(fact.answer, fact.rhs, rng),
    });
  }
  return result;
}

export function accuracy(correct: number): number {
  if (!Number.isInteger(correct) || correct < 0 || correct > 20) throw new Error('Invalid score');
  return correct * 5;
}

export function hallAward(elapsedMs: number | undefined): number {
  return elapsedMs !== undefined && elapsedMs <= KNOWLEDGE_RULES.hallFastAnswerMs
    ? KNOWLEDGE_RULES.hallFastReward
    : KNOWLEDGE_RULES.hallAnswerReward;
}

export function generateHallQuestion(
  seed: string,
  index: number,
  history: Record<string, boolean[]>,
  recent: readonly string[],
): MathQuestion {
  const rng = createSeededRandom({ seed: `${seed}:${index}`, counter: 0 });
  const pool = [...factPool('multiply'), ...factPool('divide')].filter(
    (fact) => !recent.includes(fact.factKey),
  );
  const fact = pool
    .map((candidate) => {
      const previous = history[candidate.factKey] ?? [];
      const weight =
        1 + (previous.length ? previous.filter((correct) => !correct).length / previous.length : 0);
      return { candidate, priority: -Math.log(Math.max(Number.EPSILON, rng())) / weight };
    })
    .sort((a, b) => a.priority - b.priority)[0].candidate;
  return { ...fact, id: `${seed}:${index}`, options: choices(fact.answer, fact.rhs, rng) };
}

export function grade(correct: number): string {
  accuracy(correct);
  return ['practice', 'repeat', 'almost', 'passed', 'veryGood', 'excellent', 'perfect'][
    Math.max(0, correct - 14)
  ];
}

export interface WillCapacityModifier {
  source: string;
  additionalCapacity: number;
}

/** Named future equipment seam; no items grant modifiers in this feature. */
export function effectiveWillCapacity(
  base: number,
  modifiers: readonly WillCapacityModifier[] = [],
): number {
  if (
    !Number.isInteger(base) ||
    base < 1 ||
    modifiers.some((m) => !Number.isInteger(m.additionalCapacity) || m.additionalCapacity < 0)
  )
    throw new Error('Invalid Will capacity');
  return base + modifiers.reduce((sum, modifier) => sum + modifier.additionalCapacity, 0);
}

export function stepCost(
  ctx: WillZoneContext,
  tile?: IHexCoordinates | { terrain?: TerrainId },
): number {
  const terrain = tile && 'terrain' in tile ? tile.terrain : undefined;
  return willZoneCharges(ctx) ? KNOWLEDGE_RULES.worldStepCost * terrainStepCost(terrain) : 0;
}

export function travelStepBudget(steps: number, currentWill: number, ctx: WillZoneContext): number {
  return willZoneCharges(ctx) ? Math.min(steps, Math.floor(currentWill / stepCost(ctx))) : steps;
}

function selectFacts(
  operation: MathQuestion['operation'],
  rng: RandomNumberGenerator,
  history: Record<string, boolean[]>,
) {
  return factPool(operation)
    .map((fact) => {
      const previous = history[fact.factKey] ?? [];
      const weight =
        1 + (previous.length ? previous.filter((correct) => !correct).length / previous.length : 0);
      return { fact, priority: -Math.log(Math.max(Number.EPSILON, rng())) / weight };
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 10)
    .map(({ fact }) => fact);
}
