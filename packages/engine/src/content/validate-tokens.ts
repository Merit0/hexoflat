import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { hasGeneratedName, tokenPriceRangesSchema } from '../tokens/token-content-schema';
import { wordKeyOf } from '../tokens/token-keys';
import type { TokenAttribute } from '../tokens/token-schema';
import type { UniqueTokenDefinition } from '../tokens/unique-schema';
import { coinPriceOf } from './content-accessors';
import { TOKEN_UNIQUES } from './token-uniques.content';
import {
  createTokenRegistries,
  TOKEN_CONTENT,
  TOKEN_PRICE_ANCHOR_KEY,
  type TokenContent,
} from './token-content';

export const TOKEN_NAME_MIN_COMBINATIONS = 1000;

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

function fixedAttributeFailure(
  unique: UniqueTokenDefinition,
  attribute: TokenAttribute,
  registries: TokenRegistries,
): string | null {
  const where = `unique ${unique.key}: attribute ${attribute.key}`;
  if (!registries.attributes.has(attribute.key)) return `${where} is unknown`;
  const definition = registries.attributes.get(attribute.key);
  if (definition.allowedTypes?.length && !definition.allowedTypes.includes(unique.type)) {
    return `${where} is not allowed on type ${unique.type}`;
  }
  const values = Object.values(definition.valueByTier);
  const [min, max] = [Math.min(...values), Math.max(...values)];
  if (attribute.value < min || attribute.value > max) {
    return `${where} value ${attribute.value} is outside [${min}, ${max}]`;
  }
  return null;
}

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
    for (const attribute of unique.attributes) {
      const failure = fixedAttributeFailure(unique, attribute, registries);
      if (failure) failures.push(failure);
    }
  }
  return failures;
}

export function tokenContentFailures(content: TokenContent = TOKEN_CONTENT): string[] {
  const built = registriesOf(content);
  if (!built.ok) return [built.message, ...priceFailures(content)];
  const { types, attributes, words } = built.registries;
  const failures: string[] = [];

  for (const attribute of attributes.all()) {
    for (const type of attribute.allowedTypes ?? []) {
      if (!types.has(type)) failures.push(`attribute ${attribute.key} names unknown type ${type}`);
    }
  }

  for (const type of types.all()) {
    if (type.nounKey !== wordKeyOf('noun', type.key)) {
      failures.push(
        `type ${type.key} has noun key ${type.nounKey}, expected ${wordKeyOf('noun', type.key)}`,
      );
    }
  }

  for (const type of types.all().filter(hasGeneratedName)) {
    for (const realm of type.realms) {
      const count = words.combinations(realm);
      if (count < TOKEN_NAME_MIN_COMBINATIONS) {
        failures.push(
          `${realm}+${type.key} has ${count} name combinations, needs ${TOKEN_NAME_MIN_COMBINATIONS}`,
        );
      }
    }
  }

  return [...failures, ...priceFailures(content)];
}
