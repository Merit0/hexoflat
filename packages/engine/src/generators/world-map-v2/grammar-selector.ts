import type { SeededRandom } from '../../utils/random-seeded';
import type { BoardGenerationProfile } from './board-seed';
import { GRAMMAR_IDS, type GrammarId } from './grammars';

/**
 * WORLD favours the more legible/stable shapes (a fork with a detour, or a
 * basin to walk around) over the more exotic landmark-orientation puzzle;
 * DUNGEON spreads weight evenly across all three (plan §2.7).
 */
const PROFILE_BASE_WEIGHTS: Record<BoardGenerationProfile, Record<GrammarId, number>> = {
  WORLD: { ROUTE_FORK: 1.3, BASIN: 1.3, LANDMARK_RING: 0.8 },
  DUNGEON: { ROUTE_FORK: 1, BASIN: 1, LANDMARK_RING: 1 },
};

const REPEAT_PENALTY_FACTOR = 0.35;

/** A recently-used grammar's weight must never reach zero (spec invariant 14). */
const MIN_WEIGHT_FLOOR = 0.05;

/**
 * Deterministic weighted pick. `recentGrammarIds` is the caller's rolling
 * window of the last 3 committed boards' grammar ids — each occurrence in it
 * multiplies that grammar's weight down, but never below `MIN_WEIGHT_FLOOR`,
 * so a grammar can be discouraged but never made unreachable.
 */
export function selectGrammar(
  rng: SeededRandom,
  profile: BoardGenerationProfile,
  recentGrammarIds: GrammarId[],
): GrammarId {
  const weights = GRAMMAR_IDS.map((id) => {
    const base = PROFILE_BASE_WEIGHTS[profile][id];
    const occurrences = recentGrammarIds.filter((recent) => recent === id).length;
    return Math.max(base * REPEAT_PENALTY_FACTOR ** occurrences, MIN_WEIGHT_FLOOR);
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;

  for (let i = 0; i < GRAMMAR_IDS.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return GRAMMAR_IDS[i];
  }

  return GRAMMAR_IDS[GRAMMAR_IDS.length - 1];
}
