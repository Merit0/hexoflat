import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import type { ManifestSpriteRegistry } from '../sprite-registry';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { SpriteKey, TBaseTokenType, UniqueKey } from '../token-keys';
import type { ISpriteResolver, IUniqueSpriteResolver } from './token-generation';

export class ManifestSpriteResolver implements ISpriteResolver, IUniqueSpriteResolver {
  constructor(private readonly sprites: ManifestSpriteRegistry) {}

  resolve(
    type: ItemTypeDefinition,
    tokenType: TBaseTokenType,
    rng: RandomNumberGenerator,
  ): SpriteKey {
    const refs = this.sprites.spritesFor('base', tokenType, type.key);
    return (pickRandom([...refs], rng) ?? this.sprites.placeholder).key;
  }

  resolveUnique(uniqueKey: UniqueKey): SpriteKey {
    return this.sprites.uniqueSprite(uniqueKey).key;
  }
}
