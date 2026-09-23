import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../utils/random-seeded';
import { GRAMMAR_IDS } from './grammars';
import { selectGrammar } from './grammar-selector';

describe('selectGrammar', () => {
  it('is deterministic for the same rng state', () => {
    const a = selectGrammar(deriveStream('seed-1', 'select'), 'WORLD', []);
    const b = selectGrammar(deriveStream('seed-1', 'select'), 'WORLD', []);
    expect(a).toBe(b);
  });

  it('only ever returns a known grammar id', () => {
    for (let i = 0; i < 100; i += 1) {
      const picked = selectGrammar(deriveStream(`seed-${i}`, 'select'), 'DUNGEON', []);
      expect(GRAMMAR_IDS).toContain(picked);
    }
  });

  it('produces at least 3 distinct grammars across 100 seeds with no recent-use penalty', () => {
    const picked = new Set(
      Array.from({ length: 100 }, (_, i) =>
        selectGrammar(deriveStream(`seed-${i}`, 'select'), 'WORLD', []),
      ),
    );
    expect(picked.size).toBeGreaterThanOrEqual(3);
  });

  it('never fully locks out a grammar that dominates recent history', () => {
    // Every one of the last 3 boards used ROUTE_FORK — the penalty must
    // discourage it, not eliminate it, so across enough seeds it still
    // shows up sometimes.
    const heavilyPenalized = ['ROUTE_FORK', 'ROUTE_FORK', 'ROUTE_FORK'] as const;
    const picked = new Set(
      Array.from({ length: 200 }, (_, i) =>
        selectGrammar(deriveStream(`seed-${i}`, 'select'), 'WORLD', [...heavilyPenalized]),
      ),
    );
    expect(picked.has('ROUTE_FORK')).toBe(true);
  });
});
