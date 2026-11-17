import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import type { ManifestSpriteRegistry } from '../sprite-registry';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { SpriteKey, TBaseRealm, UniqueKey } from '../token-keys';
import type { ISpriteResolver, IUniqueSpriteResolver } from './token-generation';

export class ManifestSpriteResolver implements ISpriteResolver, IUniqueSpriteResolver {
  constructor(private readonly sprites: ManifestSpriteRegistry) {}

  resolve(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): SpriteKey {
    const refs = this.sprites.spritesFor('base', realm, type.key);
    return (pickRandom([...refs], rng) ?? this.sprites.placeholder).key;
  }

  resolveUnique(uniqueKey: UniqueKey): SpriteKey {
    return this.sprites.uniqueSprite(uniqueKey).key;
  }
}
