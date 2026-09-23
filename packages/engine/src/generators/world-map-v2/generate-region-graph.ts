import { deriveStream } from '../../utils/random-seeded';
import { attemptSeed, type BoardGenerationProfile } from './board-seed';
import { GRAMMAR_BUILDERS, type GrammarId } from './grammars';
import { selectGrammar } from './grammar-selector';
import { lintRegionGraph } from './graph-linter';
import type { RegionProposition } from './region-topology';

/** Plan §2.5/G1: 12 attempts against the linter, then a deterministic fallback. */
export const MAX_GENERATION_ATTEMPTS = 12;

export interface GenerationAttemptLog {
  attemptIndex: number;
  grammarId: GrammarId;
  rejected: boolean;
  reason?: string;
}

export interface GeneratedRegion {
  proposition: RegionProposition;
  attempts: GenerationAttemptLog[];
  usedFallback: boolean;
}

/**
 * Selects a grammar, builds its graph, and lints it — retrying with a fresh
 * `attemptSeed` up to `MAX_GENERATION_ATTEMPTS` times before falling back to
 * a deterministic BASIN graph (which, built correctly, always lints clean,
 * so the fallback is a safety net rather than a path exercised in practice).
 * Never throws and never loops unbounded — this is what "never hard-lock"
 * means for the linter (G1 acceptance).
 */
export function generateRegionGraph(input: {
  boardSeed: string;
  profile: BoardGenerationProfile;
  recentGrammarIds: GrammarId[];
}): GeneratedRegion {
  const attempts: GenerationAttemptLog[] = [];

  for (let attemptIndex = 0; attemptIndex < MAX_GENERATION_ATTEMPTS; attemptIndex += 1) {
    const seed = attemptSeed(input.boardSeed, attemptIndex);
    const grammarId = selectGrammar(
      deriveStream(seed, 'grammar-select'),
      input.profile,
      input.recentGrammarIds,
    );
    const graph = GRAMMAR_BUILDERS[grammarId](deriveStream(seed, 'grammar-build'));
    const lint = lintRegionGraph(graph, [grammarId]);

    if (lint.ok) {
      attempts.push({ attemptIndex, grammarId, rejected: false });
      return {
        proposition: {
          boardSeed: input.boardSeed,
          attemptIndex,
          profile: input.profile,
          grammarIds: [grammarId],
          graph,
        },
        attempts,
        usedFallback: false,
      };
    }

    attempts.push({ attemptIndex, grammarId, rejected: true, reason: lint.reason });
  }

  const fallbackSeed = attemptSeed(input.boardSeed, MAX_GENERATION_ATTEMPTS);
  const fallbackGraph = GRAMMAR_BUILDERS.BASIN(deriveStream(fallbackSeed, 'grammar-build'));

  return {
    proposition: {
      boardSeed: input.boardSeed,
      attemptIndex: MAX_GENERATION_ATTEMPTS,
      profile: input.profile,
      grammarIds: ['BASIN'],
      graph: fallbackGraph,
    },
    attempts,
    usedFallback: true,
  };
}
