import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import type { WordPool } from '../registries';
import { hasGeneratedName, type ItemTypeDefinition } from '../token-content-schema';
import type { TBaseRealm } from '../token-keys';
import type { TokenName } from '../token-schema';
import type { INameGenerator } from './token-generation';

export class WordPoolNameGenerator implements INameGenerator {
  constructor(private readonly words: WordPool) {}

  generate(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): TokenName {
    if (!hasGeneratedName(type)) return { kind: 'noun', noun: type.key };
    const prefix = pickRandom([...this.words.prefixes(realm)], rng);
    const suffix = prefix ? pickRandom([...this.words.suffixesAfter(realm, prefix)], rng) : null;
    if (!prefix || !suffix) throw new Error(`No name words for ${realm}+${type.key}`);
    return { kind: 'generated', prefix: prefix.key, noun: type.key, suffix: suffix.key };
  }
}
