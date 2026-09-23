import { sha256Hex } from '../../utils/hash/sha256';
import type { LocationKey } from '../../registry/location-key';

/**
 * WORLD boards are generated once per world seed and persist forever
 * (silesia today: no `respawnAfterClearedMs`). DUNGEON boards regenerate on
 * every visit or on `respawnAfterClearedMs` (cave today: 60_000) — see
 * docs/WORLD-MAP-GENERATOR-V2-PLAN.md §2.7, D14.
 */
export type BoardGenerationProfile = 'WORLD' | 'DUNGEON';

/**
 * `generationVersion` is deliberately not `CONTENT_VERSION` (D9): it
 * versions this generator's own output shape, so a future generator change
 * can be told apart from an already-committed board without bumping
 * `CONTENT_VERSION` and wiping unrelated saves.
 */
export const GENERATION_VERSION = 1;

/**
 * Deterministic per-board seed. Same inputs always produce the same seed,
 * which is what makes "same seed -> same board" testable and makes a
 * reload reproduce the exact board the player left.
 */
export function boardSeed(input: {
  worldSeed: string;
  generationVersion: number;
  locationKey: LocationKey;
  profile: BoardGenerationProfile;
}): string {
  return sha256Hex(
    `${input.worldSeed}:${input.generationVersion}:${input.locationKey}:${input.profile}`,
  );
}

/**
 * Per-attempt seed, derived from the board seed plus a retry counter — used
 * by the graph linter (G1) to try a fresh candidate graph after a rejection
 * without ever touching the board seed itself.
 */
export function attemptSeed(boardSeedValue: string, attemptIndex: number): string {
  return sha256Hex(`${boardSeedValue}:${attemptIndex}`);
}
