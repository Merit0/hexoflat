import type { RandomNumberGenerator } from '../../utils/random';
import type { ItemTypeDefinition } from '../token-content-schema';
import { tokenPriceRangesSchema, type TokenPriceRanges } from '../token-content-schema';
import type { ItemTypeKey, TBaseRealm } from '../token-keys';
import type { IPriceGenerator } from './token-generation';

export class RangePriceGenerator implements IPriceGenerator {
  private readonly ranges: TokenPriceRanges;

  constructor(ranges: TokenPriceRanges) {
    this.ranges = tokenPriceRangesSchema.parse(ranges);
  }

  generate(_type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): number {
    const [min, max] = this.ranges[realm];
    return min + Math.floor(rng() * (max - min + 1));
  }
}

export class TypePriceGenerator implements IPriceGenerator {
  constructor(
    private readonly priceOfType: (type: ItemTypeKey) => number | null,
    private readonly fallback: IPriceGenerator,
  ) {}

  generate(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): number {
    return this.priceOfType(type.key) ?? this.fallback.generate(type, realm, rng);
  }
}
