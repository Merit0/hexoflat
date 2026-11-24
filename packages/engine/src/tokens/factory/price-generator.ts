import type { RandomNumberGenerator } from '../../utils/random';
import {
  tokenPriceRangesSchema,
  type PriceRange,
  type TokenPriceRanges,
} from '../token-content-schema';
import type { TBaseTokenType } from '../token-keys';
import type { IPriceGenerator } from './token-generation';

export const PRICE_BANDS = 3;

export function priceBandOf(range: PriceRange, attributeCount: number): PriceRange {
  const [min, max] = range;
  const index = Math.min(Math.max(attributeCount, 0), PRICE_BANDS - 1);
  const width = max - min + 1;
  const low = min + Math.floor((index * width) / PRICE_BANDS);
  const high = min + Math.floor(((index + 1) * width) / PRICE_BANDS) - 1;
  return [low, Math.max(low, high)];
}

export class RangePriceGenerator implements IPriceGenerator {
  private readonly ranges: TokenPriceRanges;

  constructor(ranges: TokenPriceRanges) {
    this.ranges = tokenPriceRangesSchema.parse(ranges);
  }

  generate(tokenType: TBaseTokenType, attributeCount: number, rng: RandomNumberGenerator): number {
    const [min, max] = priceBandOf(this.ranges[tokenType], attributeCount);
    return min + Math.floor(rng() * (max - min + 1));
  }
}
