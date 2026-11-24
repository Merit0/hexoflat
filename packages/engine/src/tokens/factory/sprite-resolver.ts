import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import { reportSpriteFallback } from '../sprite-fallback-log';
import type { ManifestSpriteRegistry } from '../sprite-registry';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { SpriteKey, TBaseTokenType } from '../token-keys';
import type { ISpriteResolver } from './token-generation';

export class ManifestSpriteResolver implements ISpriteResolver {
  constructor(private readonly sprites: ManifestSpriteRegistry) {}

  resolve(
    type: ItemTypeDefinition,
    tokenType: TBaseTokenType,
    rng: RandomNumberGenerator,
  ): SpriteKey | null {
    const resolution = this.sprites.resolveBase(tokenType, type.key);
    if (resolution.step !== 'own') {
      reportSpriteFallback(tokenType, type.key, resolution);
      return null;
    }
    return pickRandom([...resolution.refs], rng)?.key ?? null;
  }
}
