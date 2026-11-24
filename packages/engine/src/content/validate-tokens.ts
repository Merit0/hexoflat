import { ETokenType } from '../abstraction/hexobject-abstraction';
import { attributeProfilesSchema } from '../tokens/equipment/attribute-profile-schema';
import { ADJECTIVE_BANDS } from '../tokens/equipment/equipment-keys';
import { adjectivesFor, baseAllowlistFailures } from '../tokens/equipment/equipment-content-rules';
import { hasGeneratedName, tokenPriceRangesSchema } from '../tokens/token-content-schema';
import { wordKeyOf } from '../tokens/token-keys';
import { uniqueAttributeProfiles } from '../tokens/unique-attribute-profiles';
import { uniqueTemplateFailures } from '../tokens/unique-content-rules';
import type { UniqueTokenContent } from '../tokens/unique-schema';
import { coinPriceOf } from './content-accessors';
import { TOKEN_UNIQUES } from './token-uniques.content';
import {
  createTokenRegistries,
  TOKEN_CONTENT,
  TOKEN_PRICE_ANCHOR_KEY,
  type TokenContent,
} from './token-content';

function registriesOf(content: TokenContent) {
  try {
    return { ok: true as const, registries: createTokenRegistries(content) };
  } catch (error) {
    return { ok: false as const, message: (error as Error).message };
  }
}

function priceFailures(content: TokenContent): string[] {
  const parsed = tokenPriceRangesSchema.safeParse(content.priceRanges);
  if (!parsed.success) return [parsed.error.message];
  const anchor = coinPriceOf(TOKEN_PRICE_ANCHOR_KEY);
  const [min, max] = parsed.data[ETokenType.IDOL];
  if (anchor === null || anchor < min || anchor > max) {
    return [
      `idol price range [${min}, ${max}] does not hold the ${TOKEN_PRICE_ANCHOR_KEY} price ${anchor}`,
    ];
  }
  return [];
}

type TokenRegistries = ReturnType<typeof createTokenRegistries>;

export function uniqueContentFailures(
  uniques: readonly UniqueTokenContent[] = TOKEN_UNIQUES,
  content: TokenContent = TOKEN_CONTENT,
): string[] {
  let registries: TokenRegistries;
  try {
    registries = createTokenRegistries(content, uniques);
  } catch (error) {
    return [(error as Error).message];
  }
  const profiles = attributeProfilesSchema.safeParse(content.profiles);
  if (!profiles.success) return [profiles.error.message];
  const uniqueProfiles = uniqueAttributeProfiles(profiles.data, registries.attributes.all());
  return uniqueTemplateFailures({ ...registries, uniqueProfiles });
}

export function tokenContentFailures(content: TokenContent = TOKEN_CONTENT): string[] {
  const built = registriesOf(content);
  if (!built.ok) return [built.message, ...priceFailures(content)];
  const { types } = built.registries;
  const failures: string[] = [];

  for (const type of types.all()) {
    if (type.nounKey !== wordKeyOf('noun', type.key)) {
      failures.push(
        `type ${type.key} has noun key ${type.nounKey}, expected ${wordKeyOf('noun', type.key)}`,
      );
    }
    if (!type.group || !type.gender || !type.materials) {
      failures.push(`type ${type.key} needs a group, a gender and materials`);
    }
  }

  for (const type of types.all().filter(hasGeneratedName)) {
    for (const band of ADJECTIVE_BANDS) {
      if (adjectivesFor(type, band, content.adjectives).length === 0) {
        failures.push(`type ${type.key} has no ${band} adjective`);
      }
    }
  }

  const profiles = attributeProfilesSchema.safeParse(content.profiles);
  if (profiles.success) {
    failures.push(
      ...baseAllowlistFailures(content.baseItems, content.types, content.attributes, profiles.data),
    );
  }
  return [...failures, ...priceFailures(content)];
}
