import {
  createTokenRegistries,
  TOKEN_CONTENT,
  type TokenContent,
} from '../../content/token-content';
import type { SpriteManifest } from '../sprite-files';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { WeightedAttributeGenerator } from './attribute-generator';
import { SpecSheetDescriptionBuilder } from './description-builder';
import { WordPoolNameGenerator } from './name-generator';
import { RangePriceGenerator } from './price-generator';
import { EmptySkillGenerator } from './skill-generator';
import { ManifestSpriteResolver } from './sprite-resolver';
import { TokenFactory } from './token-factory';
import { ZodTokenValidator } from './token-validator';
import { RealmTypePicker } from './type-picker';

export function createTokenFactory(
  content: TokenContent = TOKEN_CONTENT,
  manifest: SpriteManifest = SPRITE_MANIFEST,
): TokenFactory {
  const { types, attributes, words } = createTokenRegistries(content);
  return new TokenFactory({
    typePicker: new RealmTypePicker(types),
    nameGenerator: new WordPoolNameGenerator(words),
    spriteResolver: new ManifestSpriteResolver(new ManifestSpriteRegistry(manifest)),
    attributeGenerator: new WeightedAttributeGenerator(attributes),
    skillGenerator: new EmptySkillGenerator(),
    priceGenerator: new RangePriceGenerator(content.priceRanges),
    descriptionBuilder: new SpecSheetDescriptionBuilder(attributes),
    validator: new ZodTokenValidator(),
  });
}
