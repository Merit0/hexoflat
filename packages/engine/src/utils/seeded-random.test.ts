import { describe, expect, it } from 'vitest';
import { pickRandom } from './random';
import { cloneRngState, createRngState, createSeededRandom, randomAt } from './seeded-random';

function draw(seed: string, count: number): number[] {
  const random = createSeededRandom(createRngState(seed));

  return Array.from({ length: count }, () => random());
}

describe('createSeededRandom', () => {
  it('produces the same sequence twice for the same seed', () => {
    expect(draw('world-a', 20)).toEqual(draw('world-a', 20));
  });

  it('produces a different sequence for a different seed', () => {
    expect(draw('world-a', 20)).not.toEqual(draw('world-b', 20));
  });

  it('stays inside [0, 1), same contract as Math.random', () => {
    for (const value of draw('range-check', 200)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not repeat itself over a long run', () => {
    const values = draw('variety', 500);

    expect(new Set(values).size).toBe(values.length);
  });

  it('spreads roughly evenly across the range', () => {
    const buckets = [0, 0, 0, 0];
    for (const value of draw('distribution', 4000)) {
      buckets[Math.floor(value * 4)] += 1;
    }

    // A generator that clustered (or only ever returned small values, the
    // classic sign of a botched digest-to-float conversion) fails this.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });

  it('advances the cursor in the caller’s state object, one per draw', () => {
    const state = createRngState('cursor');
    const random = createSeededRandom(state);

    random();
    random();
    random();

    expect(state.cursor).toBe(3);
  });

  it('resumes from a restored cursor instead of replaying the sequence', () => {
    const full = draw('resume', 6);

    const state = createRngState('resume');
    const first = createSeededRandom(state);
    first();
    first();
    first();

    const resumed = createSeededRandom(cloneRngState(state));

    expect([resumed(), resumed(), resumed()]).toEqual(full.slice(3));
  });

  it('is a pure function of (seed, cursor) — randomAt needs no call history', () => {
    const state = createRngState('pure');
    const random = createSeededRandom(state);

    const drawn = [random(), random(), random()];

    expect([0, 1, 2].map((cursor) => randomAt(state, cursor))).toEqual(drawn);
  });

  it('drives pickRandom reproducibly', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const pick = (seed: string) => {
      const random = createSeededRandom(createRngState(seed));
      return Array.from({ length: 10 }, () => pickRandom(items, random));
    };

    expect(pick('picks')).toEqual(pick('picks'));
    expect(pick('picks')).not.toEqual(pick('other-picks'));
  });
});
