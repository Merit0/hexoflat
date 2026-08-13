/**
 * Random number generation for game rules.
 *
 * Rules never call `Math.random` inline — they take a generator. That is what
 * lets the same inputs plus the same seed reproduce the same outcome, which
 * replay, snapshots and authoritative co-op validation all depend on
 * (architecture rule #4). Swapping in a seeded generator later touches only
 * the call sites that pass one in, not the rules themselves.
 */

/** Returns a float in [0, 1) — same contract as `Math.random`. */
export type RandomNumberGenerator = () => number;

/**
 * The unseeded default. Used by the app for ordinary play, where variety
 * matters and reproducibility does not.
 */
export const defaultRandom: RandomNumberGenerator = () => Math.random();

/**
 * Picks one item at random. Returns null for an empty list so callers branch
 * on "nothing available" rather than on an undefined element.
 */
export function pickRandom<T>(items: T[], random: RandomNumberGenerator): T | null {
  if (!items.length) return null;
  return items[Math.floor(random() * items.length)];
}
