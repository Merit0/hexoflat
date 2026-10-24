import { describe, expect, it } from 'vitest';
import { intOrRange, intRange } from './piece-schemas';
import { runBoardPipeline } from './run-board-pipeline';
import { CAVE_MODEL } from '../../content/boards/models/cave';

describe('range schemas', () => {
  it('intRange accepts ordered pairs inside the bounds and rejects reversed ones', () => {
    expect(intRange(1).safeParse([2, 5]).success).toBe(true);
    expect(intRange(1).safeParse([3, 3]).success).toBe(true);
    expect(intRange(1).safeParse([5, 3]).success).toBe(false);
    expect(intRange(1, 2).safeParse([1, 3]).success).toBe(false);
    expect(intRange(1).safeParse([0, 2]).success).toBe(false);
  });

  it('intOrRange takes a single number or an ordered pair', () => {
    expect(intOrRange(0).safeParse(4).success).toBe(true);
    expect(intOrRange(0).safeParse([0, 4]).success).toBe(true);
    expect(intOrRange(0).safeParse([4, 0]).success).toBe(false);
  });

  it('a model with a reversed count fails loudly instead of rolling outside the range', () => {
    const reversed = structuredClone(CAVE_MODEL);
    (reversed.stages.form[0] as { count: unknown }).count = [5, 3];

    expect(() => runBoardPipeline(reversed, { seed: 'x' })).toThrow(/minimum must not exceed/);
  });
});
