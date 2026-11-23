import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { attributeProfilesSchema } from '../tokens/equipment/attribute-profile-schema';
import { ADJECTIVE_BANDS } from '../tokens/equipment/equipment-keys';
import { adjectivesFor, baseAllowlistFailures } from '../tokens/equipment/equipment-content-rules';
import { hasGeneratedName, tokenPriceRangesSchema } from '../tokens/token-content-schema';
import { wordKeyOf } from '../tokens/token-keys';
import { attributeFailure, dependencyFailure } from '../tokens/attribute-rules';
import type { UniqueTokenDefinition } from '../tokens/unique-schema';
import { coinPriceOf } from './content-accessors';
import { TOKEN_UNIQUES } from './token-uniques.content';
import {
  createTokenRegistries,
  TOKEN_CONTENT,
  TOKEN_PRICE_ANCHOR_KEY,
  type TokenContent,
} from './token-content';

const UNIQUE_CHECK = { origin: 'unique' } as const;

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
  const [min, max] = parsed.data[ERarityKind.IDOL];
  if (anchor === null || anchor < min || anchor > max) {
    return [
      `idol price range [${min}, ${max}] does not hold the ${TOKEN_PRICE_ANCHOR_KEY} price ${anchor}`,
    ];
  }
  return [];
}

type TokenRegistries = ReturnType<typeof createTokenRegistries>;

export function uniqueContentFailures(
  uniques: readonly UniqueTokenDefinition[] = TOKEN_UNIQUES,
  content: TokenContent = TOKEN_CONTENT,
): string[] {
  let registries: TokenRegistries;
  try {
    registries = createTokenRegistries(content, uniques);
  } catch (error) {
    return [(error as Error).message];
  }
  const failures: string[] = [];
  for (const unique of registries.uniques.all()) {
    if (!registries.types.has(unique.type)) {
      failures.push(`unique ${unique.key} names unknown type ${unique.type}`);
      continue;
    }
    const type = registries.types.get(unique.type);
    for (const attribute of unique.attributes) {
      const failure = attributeFailure(registries.attributes, type, attribute, UNIQUE_CHECK, 1);
      if (failure) failures.push(`unique ${unique.key}: ${failure}`);
    }
    const missing = dependencyFailure(registries.attributes, unique.attributes);
    if (missing) failures.push(`unique ${unique.key}: ${missing}`);
  }
  return failures;
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
