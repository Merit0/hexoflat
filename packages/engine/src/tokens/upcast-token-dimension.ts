import { dimensionOfTokenType, tokenTypeSchema } from '../dimensions/dimensions';

const LEGACY_TOKEN_TYPE_KEY = 'content.tokens.realm.';
const TOKEN_TYPE_KEY = 'content.tokens.tokenType.';

function renameLegacyFields(token: Record<string, unknown>): Record<string, unknown> {
  const { origin, rarity, ...rest } = token;
  return {
    ...rest,
    ...(rest.tier === undefined && origin !== undefined ? { tier: origin } : {}),
    ...(rest.tokenType === undefined && rarity !== undefined ? { tokenType: rarity } : {}),
  };
}

/** Compatibility reader only: never regenerates identity, stats, price or source tier. */
export function upcastTokenDimension(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const token = renameLegacyFields(raw as Record<string, unknown>);
  const legacyAlien = token.tokenType === 'god-executor';
  const tokenType = legacyAlien ? 'alien' : token.tokenType;
  const parsed = tokenTypeSchema.safeParse(tokenType);
  if (!parsed.success) return token; // The strict token schema supplies the diagnostic.
  return {
    ...token,
    tokenType,
    ...(token.tier === 'base' && token.baseKey === undefined && typeof token.type === 'string'
      ? { baseKey: `${dimensionOfTokenType(parsed.data)}-${token.type}` }
      : {}),
    ...(token.dimension === undefined ? { dimension: dimensionOfTokenType(parsed.data) } : {}),
    ...(Array.isArray(token.description)
      ? { description: token.description.map(upcastDescriptionLine) }
      : {}),
  };
}

function upcastParamValue(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith(LEGACY_TOKEN_TYPE_KEY)) return value;
  const name = value.slice(LEGACY_TOKEN_TYPE_KEY.length);
  return `${TOKEN_TYPE_KEY}${name === 'god-executor' ? 'alien' : name}`;
}

function upcastDescriptionLine(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const line = raw as { params?: unknown };
  if (!line.params || typeof line.params !== 'object') return raw;
  const { realm, ...params } = line.params as Record<string, unknown>;
  const renamed =
    realm === undefined || 'tokenType' in params ? line.params : { ...params, tokenType: realm };
  return {
    ...line,
    params: Object.fromEntries(
      Object.entries(renamed as Record<string, unknown>).map(([key, value]) => [
        key,
        upcastParamValue(value),
      ]),
    ),
  };
}
