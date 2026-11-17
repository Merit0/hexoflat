import type { RandomNumberGenerator } from '../../utils/random';
import { pickWeightedIndex } from '../../utils/weighted-pick';
import type { AttributeRegistry } from '../registries';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { TMapTier } from '../token-keys';
import type { TokenAttribute } from '../token-schema';
import type { AttributeRollOptions, IAttributeGenerator } from './token-generation';

export const MAX_BASE_TOKEN_ATTRIBUTES = 2;

export class WeightedAttributeGenerator implements IAttributeGenerator {
  constructor(
    private readonly attributes: AttributeRegistry,
    private readonly maxCount: number = MAX_BASE_TOKEN_ATTRIBUTES,
  ) {}

  generate(
    type: ItemTypeDefinition,
    mapTier: TMapTier,
    rng: RandomNumberGenerator,
    options: AttributeRollOptions = {},
  ): TokenAttribute[] {
    const excluded = new Set(options.exclude ?? []);
    const wanted = options.count ?? Math.floor(rng() * (this.maxCount + 1));
    const pool = this.attributes
      .generatableFor(type.key)
      .filter((definition) => !excluded.has(definition.key));
    const picked: TokenAttribute[] = [];
    while (picked.length < wanted) {
      const index = pickWeightedIndex(
        pool.map((definition) => definition.weight),
        rng,
      );
      if (index === null) break;
      const [definition] = pool.splice(index, 1);
      picked.push({ key: definition.key, value: definition.valueByTier[mapTier] });
    }
    return picked;
  }
}
