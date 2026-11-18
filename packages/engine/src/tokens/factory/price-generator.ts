import type { RandomNumberGenerator } from '../../utils/random';
import { tokenPriceRangesSchema, type TokenPriceRanges } from '../token-content-schema';
import type { TBaseRealm } from '../token-keys';
import type { IPriceGenerator } from './token-generation';

export class RangePriceGenerator implements IPriceGenerator {
  private readonly ranges: TokenPriceRanges;

  constructor(ranges: TokenPriceRanges) {
    this.ranges = tokenPriceRangesSchema.parse(ranges);
  }

  generate(realm: TBaseRealm, rng: RandomNumberGenerator): number {
    const [min, max] = this.ranges[realm];
    return min + Math.floor(rng() * (max - min + 1));
  }
}
