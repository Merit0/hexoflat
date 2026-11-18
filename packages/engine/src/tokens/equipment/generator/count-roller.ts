import type { RandomNumberGenerator } from '../../../utils/random';
import type { CountRequest, ICountRoller, IWeightedPicker } from './generator-contracts';

export class WeightedCountRoller implements ICountRoller {
  constructor(private readonly picker: IWeightedPicker) {}

  roll(request: CountRequest, rng: RandomNumberGenerator): number {
    const rolled = this.picker.pick(request.countWeights, rng) ?? 0;
    return Math.max(0, Math.min(rolled, request.maxCount, request.poolSize));
  }
}
