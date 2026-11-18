import { TOKEN_NAME_SHAPE_WEIGHTS, type TokenNameShape } from '../../content/token-words.content';
import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import { pickWeightedIndex } from '../../utils/weighted-pick';
import type { WordPool } from '../registries';
import { hasGeneratedName, type ItemTypeDefinition } from '../token-content-schema';
import type { TBaseRealm } from '../token-keys';
import type { TokenName } from '../token-schema';
import type { INameGenerator } from './token-generation';

const SHAPES = Object.keys(TOKEN_NAME_SHAPE_WEIGHTS) as TokenNameShape[];

export class WordPoolNameGenerator implements INameGenerator {
  constructor(
    private readonly words: WordPool,
    private readonly shapeWeights: Readonly<
      Record<TokenNameShape, number>
    > = TOKEN_NAME_SHAPE_WEIGHTS,
  ) {}

  generate(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): TokenName {
    if (!hasGeneratedName(type)) return { kind: 'noun', noun: type.key };
    const shape =
      SHAPES[
        pickWeightedIndex(
          SHAPES.map((key) => this.shapeWeights[key]),
          rng,
        ) ?? 0
      ];
    if (shape === 'suffix') {
      const suffix = pickRandom([...this.words.suffixes(realm)], rng);
      if (!suffix) throw new Error(`No name words for ${realm}+${type.key}`);
      return { kind: 'generated', noun: type.key, suffix: suffix.key };
    }
    const prefix = pickRandom([...this.words.prefixes(realm)], rng);
    if (!prefix) throw new Error(`No name words for ${realm}+${type.key}`);
    if (shape === 'prefix') return { kind: 'generated', prefix: prefix.key, noun: type.key };
    const suffix = pickRandom([...this.words.suffixesAfter(realm, prefix)], rng);
    if (!suffix) throw new Error(`No name words for ${realm}+${type.key}`);
    return { kind: 'generated', prefix: prefix.key, noun: type.key, suffix: suffix.key };
  }
}
