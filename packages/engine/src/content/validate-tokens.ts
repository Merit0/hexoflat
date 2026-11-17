import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { tokenPriceRangesSchema } from '../tokens/token-content-schema';
import { coinPriceOf } from './content-accessors';
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
