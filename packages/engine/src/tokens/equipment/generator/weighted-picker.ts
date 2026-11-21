import type { RandomNumberGenerator } from '../../../utils/random';
import { pickWeightedIndex } from '../../../utils/weighted-pick';
import type { IWeightedPicker } from './generator-contracts';

export class CumulativeWeightedPicker implements IWeightedPicker {
  pick(weights: readonly number[], rng: RandomNumberGenerator): number | null {
    return pickWeightedIndex(weights, rng);
  }
}
