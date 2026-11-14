import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../utils/random-seeded';
import { SEEKER_CARDS } from '../seeker-content';
import { matchingNexts } from './alternatives';
import { decoyCandidates, pickDecoys, type DecoyContext } from './decoys';
import { generateSequence } from './generate';
import { continueFrom, termsFitLimits } from './rules';
import { bruteNexts } from './sequence-test-setup';

const SEEDS = 1000;
const WANTED = 5;

function expectGoodDecoys(ctx: DecoyContext, decoys: number[], wanted: number) {
  expect(new Set(decoys).size).toBe(decoys.length);
  const independent = ctx.seen.length >= 3 ? bruteNexts(ctx.seen) : [];
  const blocked = new Set([...matchingNexts(ctx.seen), ...independent]);
  for (const decoy of decoys) {
    expect(decoy).not.toBe(ctx.next);
    expect(blocked.has(decoy)).toBe(false);
    const tail = continueFrom(ctx.rule, ctx.step, decoy, ctx.length);
    expect(termsFitLimits([decoy, ...tail], ctx.maxDigits)).toBe(true);
  }
  const { close, far } = decoyCandidates(ctx);
  expect(decoys.length).toBe(Math.min(wanted, close.length + far.length));
  const picked = decoys.filter((d) => close.includes(d)).length;
  expect(picked).toBeGreaterThanOrEqual(Math.min(2, close.length, wanted));
}

describe('decoys', () => {
  it.each(SEEKER_CARDS.map((card, index) => [card.id, index] as const))(
    "REQ-QST-004: %s decoys are distinct, never the next term, never a rival rule's next term",
    (_id, index) => {
      const card = SEEKER_CARDS[index];
      for (let seed = 0; seed < SEEDS; seed += 1) {
        const rng = deriveStream(`${card.id}:${seed}`, 'quest:decoys');
        const { rule, terms } = generateSequence(
          card.params,
          deriveStream(`${card.id}:${seed}`, 'quest:rule'),
        );
        const length = card.params.steps;
        const common = { rule, length, maxDigits: card.params.maxDigits };
        const step = 1 + Math.floor(rng() * length);
        const trueCtx: DecoyContext = {
          ...common,
          step,
          seen: terms.slice(0, step - 1),
          next: terms[step - 1],
          after: terms[step] ?? null,
        };
        expectGoodDecoys(trueCtx, pickDecoys(trueCtx, WANTED, rng), WANTED);

        if (step >= length) continue;
        const [wrong] = pickDecoys(trueCtx, 1, rng);
        if (wrong === undefined) continue;
        const falseTail = continueFrom(rule, step, wrong, length);
        if (falseTail.length < 2) continue;
        const falseCtx: DecoyContext = {
          ...common,
          step: step + 1,
          seen: [...terms.slice(0, step - 1), wrong],
          next: falseTail[0],
          after: falseTail[1] ?? null,
        };
        expectGoodDecoys(falseCtx, pickDecoys(falseCtx, WANTED, rng), WANTED);
      }
    },
  );

  it('REQ-QST-004: the same seed gives the same decoys', () => {
    const card = SEEKER_CARDS[1];
    const { rule, terms } = generateSequence(card.params, deriveStream('x', 'rule'));
    const ctx: DecoyContext = {
      rule,
      length: card.params.steps,
      maxDigits: card.params.maxDigits,
      step: 5,
      seen: terms.slice(0, 4),
      next: terms[4],
      after: terms[5],
    };
    expect(pickDecoys(ctx, 4, deriveStream('x', 'd'))).toEqual(
      pickDecoys(ctx, 4, deriveStream('x', 'd')),
    );
  });
});
