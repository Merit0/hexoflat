import {
  createTokenRegistries,
  TOKEN_CONTENT,
  type TokenContent,
} from '../../content/token-content';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import { attributeProfilesSchema } from '../equipment/attribute-profile-schema';
import { createEquipmentAttributeGenerator } from '../equipment/generator/create-equipment-attribute-generator';
import type { SpriteManifest } from '../sprite-files';
import type { UniqueTokenContent } from '../unique-schema';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { SpecSheetDescriptionBuilder } from './description-builder';
import { AdjectiveNameGenerator } from './name-generator';
import { RangePriceGenerator } from './price-generator';
import { EmptySkillGenerator } from './skill-generator';
import { ManifestSpriteResolver } from './sprite-resolver';
import { TokenFactory, type TokenFactoryParts } from './token-factory';
import { ZodTokenValidator } from './token-validator';
import { BaseTypePicker } from './type-picker';
import { validateFactoryContent } from './validate-factory-content';

export function createTokenFactory(
  content: TokenContent = TOKEN_CONTENT,
  manifest: SpriteManifest = SPRITE_MANIFEST,
  uniqueDefinitions: readonly UniqueTokenContent[] = TOKEN_UNIQUES,
  steps: Partial<Omit<TokenFactoryParts, 'validator'>> = {},
): TokenFactory {
  const profiles = attributeProfilesSchema.parse(content.profiles);
  const { types, attributes, uniques, baseItems } = createTokenRegistries(
    content,
    uniqueDefinitions,
  );
  validateFactoryContent({ types, attributes, uniques, content });
  return new TokenFactory(
    {
      baseItems,
      typePicker: new BaseTypePicker(types),
      nameGenerator: new AdjectiveNameGenerator(content.adjectives),
      spriteResolver: new ManifestSpriteResolver(new ManifestSpriteRegistry(manifest)),
      attributeGenerator: createEquipmentAttributeGenerator(attributes, profiles),
      skillGenerator: new EmptySkillGenerator(),
      priceGenerator: new RangePriceGenerator(content.priceRanges),
      descriptionBuilder: new SpecSheetDescriptionBuilder(),
      ...steps,
      validator: new ZodTokenValidator(types, attributes, profiles, baseItems),
    },
    { types, uniques },
  );
}
