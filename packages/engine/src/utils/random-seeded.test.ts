import { describe, expect, it } from 'vitest';
import { pickRandom } from './random';
import { createSeededRandom, deriveStream } from './random-seeded';

function sequence(gen: () => number, n: number): number[] {
  return Array.from({ length: n }, () => gen());
}

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = sequence(createSeededRandom({ seed: 'root', counter: 0 }), 20);
    const b = sequence(createSeededRandom({ seed: 'root', counter: 0 }), 20);

    expect(a).toEqual(b);
  });

  it('produces a different sequence for a different seed', () => {
    const a = sequence(createSeededRandom({ seed: 'root', counter: 0 }), 20);
    const b = sequence(createSeededRandom({ seed: 'other', counter: 0 }), 20);

    expect(a).not.toEqual(b);
  });

  it('stays in [0, 1)', () => {
    const gen = createSeededRandom({ seed: 'root', counter: 0 });
    for (let i = 0; i < 200; i += 1) {
      const value = gen();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('advances and exposes its state so a stream can be resumed', () => {
    const gen = createSeededRandom({ seed: 'root', counter: 0 });
    gen();
    gen();
    gen();

    expect(gen.state).toEqual({ seed: 'root', counter: 3 });

    const resumed = createSeededRandom(gen.state);
    const fresh = createSeededRandom({ seed: 'root', counter: 0 });
    sequence(fresh, 3);

    expect(sequence(resumed, 5)).toEqual(sequence(fresh, 5));
  });
});

describe('deriveStream', () => {
  it('gives different sequences for different labels under the same root seed', () => {
    const a = sequence(deriveStream('root', 'combat'), 20);
    const b = sequence(deriveStream('root', 'world'), 20);

    expect(a).not.toEqual(b);
  });

  it('is reproducible per label', () => {
    const a = sequence(deriveStream('root', 'combat'), 20);
    const b = sequence(deriveStream('root', 'combat'), 20);

    expect(a).toEqual(b);
  });

  it('substreams are independent: consuming one does not shift another', () => {
    const combat = deriveStream('root', 'combat');
    sequence(combat, 50);

    const worldAfter = sequence(deriveStream('root', 'world'), 20);
    const worldFresh = sequence(deriveStream('root', 'world'), 20);

    expect(worldAfter).toEqual(worldFresh);
  });

  it('replays the same run of enemy AI choices from the same seed', () => {
    const options = ['attack-north', 'attack-east', 'retreat', 'wait'];
    const playOut = () => {
      const combat = deriveStream('battle-seed', 'combat');
      return Array.from({ length: 10 }, () => pickRandom(options, combat));
    };

    expect(playOut()).toEqual(playOut());
  });
});
