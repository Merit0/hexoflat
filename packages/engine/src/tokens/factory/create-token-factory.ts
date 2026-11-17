import {
  createTokenRegistries,
  TOKEN_CONTENT,
  type TokenContent,
} from '../../content/token-content';
import { CONTENT } from '../../content/content-map';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import type { SpriteManifest } from '../sprite-files';
import type { UniqueTokenDefinition } from '../unique-schema';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { WeightedAttributeGenerator } from './attribute-generator';
import { SpecSheetDescriptionBuilder } from './description-builder';
import { WordPoolNameGenerator } from './name-generator';
import { RangePriceGenerator, TypePriceGenerator } from './price-generator';
import { EmptySkillGenerator } from './skill-generator';
import { ManifestSpriteResolver } from './sprite-resolver';
import { TokenFactory } from './token-factory';
import { ZodTokenValidator } from './token-validator';
import { RealmTypePicker } from './type-picker';

function coinPriceOfType(type: string): number | null {
  const content = (CONTENT as Record<string, { coinPrice?: number } | undefined>)[type];
  return content?.coinPrice ?? null;
}

export function createTokenFactory(
  content: TokenContent = TOKEN_CONTENT,
  manifest: SpriteManifest = SPRITE_MANIFEST,
  uniqueDefinitions: readonly UniqueTokenDefinition[] = TOKEN_UNIQUES,
): TokenFactory {
  const { types, attributes, words, uniques } = createTokenRegistries(content, uniqueDefinitions);
  const spriteResolver = new ManifestSpriteResolver(new ManifestSpriteRegistry(manifest));
  return new TokenFactory(
    {
      typePicker: new RealmTypePicker(types),
      nameGenerator: new WordPoolNameGenerator(words),
      spriteResolver,
      attributeGenerator: new WeightedAttributeGenerator(attributes),
      skillGenerator: new EmptySkillGenerator(),
      priceGenerator: new TypePriceGenerator(
        coinPriceOfType,
        new RangePriceGenerator(content.priceRanges),
      ),
      descriptionBuilder: new SpecSheetDescriptionBuilder(attributes),
      validator: new ZodTokenValidator(),
    },
    { types, uniques, spriteResolver },
  );
}
