import type { SeededRandom } from '../../../utils/random-seeded';

/** Integer in `[min, max]`, inclusive on both ends. */
export function pickInt(rng: SeededRandom, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
