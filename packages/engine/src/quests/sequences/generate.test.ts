import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../utils/random-seeded';
import { SEEKER_CARDS } from '../seeker-content';
import { isUnambiguous, matchingNexts } from './alternatives';
import { generateSequence } from './generate';
import { bruteNexts } from './sequence-test-setup';

const SEEDS = 1000;

function generated(cardIndex: number, seed: number) {
  const card = SEEKER_CARDS[cardIndex];
  const result = generateSequence(card.params, deriveStream(`${card.id}:${seed}`, 'quest:rule'));
  return { card, ...result };
}

describe('sequence generation', () => {
  it.each(SEEKER_CARDS.map((card, index) => [card.id, index] as const))(
    'REQ-QST-002: %s always gives whole positive terms within maxDigits',
    (_id, index) => {
      const limit = 10 ** SEEKER_CARDS[index].params.maxDigits - 1;
      for (let seed = 0; seed < SEEDS; seed += 1) {
        const { card, terms, hintSteps } = generated(index, seed);
        expect(terms).toHaveLength(card.params.steps);
        expect(terms.every((t) => Number.isInteger(t) && t > 0 && t <= limit)).toBe(true);
        expect(hintSteps).toBeGreaterThanOrEqual(card.params.hintSteps);
        expect(hintSteps).toBeLessThanOrEqual(card.params.steps - 2);
      }
    },
  );

  it.each(SEEKER_CARDS.map((card, index) => [card.id, index] as const))(
    'REQ-QST-003: %s is unambiguous from the hint on, against an independent catalogue',
    (_id, index) => {
      for (let seed = 0; seed < SEEDS; seed += 1) {
        const { terms, hintSteps } = generated(index, seed);
        for (let at = hintSteps; at < terms.length; at += 1) {
          const prefix = terms.slice(0, at);
          expect(isUnambiguous(prefix, terms[at])).toBe(true);
          expect(bruteNexts(prefix).every((next) => next === terms[at])).toBe(true);
        }
      }
    },
  );

  it('REQ-QST-003: the catalogue sees both readings of 1, 3, 6', () => {
    expect(matchingNexts([1, 3, 6])).toEqual(expect.arrayContaining([8, 10]));
    expect(isUnambiguous([1, 3, 6], 10)).toBe(false);
    expect(isUnambiguous([1, 3, 6, 10], 15)).toBe(true);
  });

  it('REQ-QST-003: the same seed gives the same rule', () => {
    expect(generated(2, 7)).toEqual(generated(2, 7));
  });
});
