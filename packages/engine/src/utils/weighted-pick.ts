import type { RandomNumberGenerator } from './random';

export function pickWeightedIndex(
  weights: readonly number[],
  rng: RandomNumberGenerator,
): number | null {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;
  let point = rng() * total;
  for (let index = 0; index < weights.length; index += 1) {
    if (point < weights[index]) return index;
    point -= weights[index];
  }
  return weights.length - 1;
}
