import { describe, expect, it } from 'vitest';
import { defaultRandom, pickRandom } from './random';

// Fixed generators stand in for Math.random: every rule that rolls has to be
// reproducible from a seed, which is what replay and co-op validation need.
const alwaysFirst = () => 0;
const alwaysLast = () => 0.999;

describe('pickRandom', () => {
  it('returns null for an empty list rather than undefined', () => {
    expect(pickRandom([], alwaysFirst)).toBeNull();
  });

  it('is reproducible for a given generator', () => {
    const items = ['a', 'b', 'c'];

    expect(pickRandom(items, alwaysFirst)).toBe(pickRandom(items, alwaysFirst));
  });

  it('honours the generator: the two ends of the range differ', () => {
    const items = ['a', 'b', 'c'];

    expect(pickRandom(items, alwaysFirst)).toBe('a');
    expect(pickRandom(items, alwaysLast)).toBe('c');
  });

  it('never runs off the end of the list', () => {
    expect(pickRandom(['only'], alwaysLast)).toBe('only');
  });
});

describe('defaultRandom', () => {
  it('stays inside [0, 1)', () => {
    for (let i = 0; i < 50; i += 1) {
      const value = defaultRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
