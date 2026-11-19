import {
  createTokenRegistries,
  TOKEN_CONTENT,
  type TokenContent,
} from '../../content/token-content';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import { createEquipmentAttributeGenerator } from '../equipment/generator/create-equipment-attribute-generator';
import type { SpriteManifest } from '../sprite-files';
import type { UniqueTokenDefinition } from '../unique-schema';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { SpecSheetDescriptionBuilder } from './description-builder';
import { AdjectiveNameGenerator } from './name-generator';
import { RangePriceGenerator } from './price-generator';
import { EmptySkillGenerator } from './skill-generator';
import { ManifestSpriteResolver } from './sprite-resolver';
import { TokenFactory, type TokenFactoryParts } from './token-factory';
import { ZodTokenValidator } from './token-validator';
import { RealmTypePicker } from './type-picker';
import { validateFactoryContent } from './validate-factory-content';

export function createTokenFactory(
  content: TokenContent = TOKEN_CONTENT,
  manifest: SpriteManifest = SPRITE_MANIFEST,
  uniqueDefinitions: readonly UniqueTokenDefinition[] = TOKEN_UNIQUES,
  steps: Partial<Omit<TokenFactoryParts, 'validator'>> = {},
): TokenFactory {
  const { types, attributes, uniques } = createTokenRegistries(content, uniqueDefinitions);
  validateFactoryContent({ types, attributes, uniques, content });
  const spriteResolver = new ManifestSpriteResolver(new ManifestSpriteRegistry(manifest));
  return new TokenFactory(
    {
      typePicker: new RealmTypePicker(types),
      nameGenerator: new AdjectiveNameGenerator(content.adjectives),
      spriteResolver,
      attributeGenerator: createEquipmentAttributeGenerator(content.attributes, content.profiles),
      skillGenerator: new EmptySkillGenerator(),
      priceGenerator: new RangePriceGenerator(content.priceRanges),
      descriptionBuilder: new SpecSheetDescriptionBuilder(),
      ...steps,
      validator: new ZodTokenValidator(types, attributes, content.profiles),
    },
    { types, uniques, spriteResolver },
  );
}
