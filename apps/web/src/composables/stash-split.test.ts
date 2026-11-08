import { describe, expect, it } from 'vitest';
import { clampStashRatio, STASH_SPLIT } from './stash-split';

describe('clampStashRatio', () => {
  it('keeps a ratio inside 25-75 percent', () => {
    expect(clampStashRatio(0.1)).toBe(STASH_SPLIT.MIN_RATIO);
    expect(clampStashRatio(0.9)).toBe(STASH_SPLIT.MAX_RATIO);
    expect(clampStashRatio(0.4)).toBe(0.4);
  });

  it('falls back to the middle for a value that is not a number', () => {
    expect(clampStashRatio(Number.NaN)).toBe(STASH_SPLIT.DEFAULT_RATIO);
  });
});
