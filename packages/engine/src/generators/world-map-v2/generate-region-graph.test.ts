import { describe, expect, it } from 'vitest';
import { RegionPropositionSchema } from './region-topology';
import { lintRegionGraph } from './graph-linter';
import { generateRegionGraph } from './generate-region-graph';
import type { GrammarId } from './grammars';

describe('generateRegionGraph', () => {
  it('same board seed produces the same graph', () => {
    const a = generateRegionGraph({ boardSeed: 'board-1', profile: 'WORLD', recentGrammarIds: [] });
    const b = generateRegionGraph({ boardSeed: 'board-1', profile: 'WORLD', recentGrammarIds: [] });
    expect(a.proposition).toEqual(b.proposition);
  });

  it('always returns a proposition that satisfies the schema and the linter', () => {
    for (let i = 0; i < 200; i += 1) {
      const result = generateRegionGraph({
        boardSeed: `board-${i}`,
        profile: i % 2 === 0 ? 'WORLD' : 'DUNGEON',
        recentGrammarIds: [],
      });

      expect(RegionPropositionSchema.safeParse(result.proposition).success).toBe(true);
      expect(
        lintRegionGraph(result.proposition.graph, result.proposition.grammarIds as GrammarId[]),
      ).toEqual({
        ok: true,
      });
    }
  });

  it('never falls back across 200 seeds (the grammars are satisfiable on the first few attempts)', () => {
    let fallbacks = 0;
    for (let i = 0; i < 200; i += 1) {
      const result = generateRegionGraph({
        boardSeed: `board-${i}`,
        profile: 'WORLD',
        recentGrammarIds: [],
      });
      if (result.usedFallback) fallbacks += 1;
    }
    expect(fallbacks).toBe(0);
  });

  it('produces at least 3 distinct grammars across 200 seeds', () => {
    const grammars = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const result = generateRegionGraph({
        boardSeed: `board-${i}`,
        profile: 'WORLD',
        recentGrammarIds: [],
      });
      result.proposition.grammarIds.forEach((id) => grammars.add(id));
    }
    expect(grammars.size).toBeGreaterThanOrEqual(3);
  });
});
