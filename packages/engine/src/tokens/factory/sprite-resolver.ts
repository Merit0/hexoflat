import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import type { ManifestSpriteRegistry } from '../sprite-registry';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { SpriteKey, TBaseRealm } from '../token-keys';
import type { ISpriteResolver } from './token-generation';

export class ManifestSpriteResolver implements ISpriteResolver {
  constructor(private readonly sprites: ManifestSpriteRegistry) {}

  resolve(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): SpriteKey {
    const refs = this.sprites.spritesFor('base', realm, type.key);
    return (pickRandom([...refs], rng) ?? this.sprites.placeholder).key;
  }
}
