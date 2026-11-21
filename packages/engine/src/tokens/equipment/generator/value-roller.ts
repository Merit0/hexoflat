import type { RandomNumberGenerator } from '../../../utils/random';
import type { IValueRoller, ValueRange } from './generator-contracts';

export class SteppedValueRoller implements IValueRoller {
  roll(range: ValueRange, rng: RandomNumberGenerator): number {
    const choices = Math.floor((range.max - range.min) / range.step) + 1;
    const index = Math.min(choices - 1, Math.floor(rng() * choices));
    return range.min + index * range.step;
  }
}
