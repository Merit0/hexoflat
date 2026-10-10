import { sha256Hex } from '../utils/hash/sha256';
import type { LocationKey } from '../registry/location-key';

/**
 * `generationVersion` is deliberately not `CONTENT_VERSION`: it versions
 * this board format's own output shape, so a future format change can be
 * told apart from an already-committed board without bumping
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
  profile: 'WORLD' | 'DUNGEON';
}): string {
  return sha256Hex(
    `${input.worldSeed}:${input.generationVersion}:${input.locationKey}:${input.profile}`,
  );
}

/** Per-attempt seed, derived from the board seed plus a retry counter, used to try a fresh assembly after a rejected attempt without touching the board seed itself. */
export function attemptSeed(boardSeedValue: string, attemptIndex: number): string {
  return sha256Hex(`${boardSeedValue}:${attemptIndex}`);
}
