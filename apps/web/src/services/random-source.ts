import type { RandomSource } from '@hexoflat/engine/hero-movement/spawn-placement';

/**
 * The app's single adapter onto the platform RNG.
 *
 * Engine rules never call `Math.random` themselves — they take a
 * `RandomSource`, so a replay or an authoritative server can feed the same
 * seed and land on the same outcome. This module is where the browser's
 * non-deterministic implementation is plugged in, and being one named place
 * is what makes it swappable (and what lets G6 ban `Math.random` inside
 * stores outright).
 */
export const browserRandom: RandomSource = () => Math.random();
