import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import { adjectiveFits, type Adjective } from '../equipment/adjective-schema';
import { ADJECTIVE_BANDS, type TAdjectiveBand } from '../equipment/equipment-keys';
import { hasGeneratedName, type ItemTypeDefinition } from '../token-content-schema';
import type { TokenName } from '../token-schema';
import type { INameGenerator, NameRequest } from './token-generation';

export function adjectiveBandFor(attributeCount: number): TAdjectiveBand {
  return ADJECTIVE_BANDS[Math.min(Math.max(attributeCount, 0), ADJECTIVE_BANDS.length - 1)];
}

export function adjectivesForType(
  type: ItemTypeDefinition,
  band: TAdjectiveBand,
  adjectives: readonly Adjective[],
): Adjective[] {
  if (!type.group || !type.materials) return [];
  const target = { group: type.group, materials: type.materials };
  return adjectives.filter(
    (adjective) => adjective.band === band && adjectiveFits(adjective, target),
  );
}

export class AdjectiveNameGenerator implements INameGenerator {
  constructor(private readonly adjectives: readonly Adjective[]) {}

  generate(request: NameRequest, rng: RandomNumberGenerator): TokenName {
    const { type, attributeCount } = request;
    if (!hasGeneratedName(type)) return { kind: 'noun', noun: type.key };
    const band = adjectiveBandFor(attributeCount);
    const adjective = pickRandom(adjectivesForType(type, band, this.adjectives), rng);
    if (!adjective) throw new Error(`No ${band} adjective for ${type.key}`);
    return { kind: 'adjective', adjective: adjective.key, noun: type.key };
  }
}
