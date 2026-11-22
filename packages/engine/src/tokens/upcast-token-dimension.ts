import { dimensionOfItemFamily, itemFamilySchema } from '../dimensions/dimensions';

/** Compatibility reader only: never regenerates identity, stats, price or source tier. */
export function upcastTokenDimension(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const token = raw as Record<string, unknown>;
  const legacyAlien = token.rarity === 'god-executor';
  const rarity = legacyAlien ? 'alien' : token.rarity;
  const family = itemFamilySchema.safeParse(rarity);
  if (!family.success) return raw; // The strict token schema supplies the diagnostic.
  return {
    ...token,
    rarity,
    ...(token.dimension === undefined ? { dimension: dimensionOfItemFamily(family.data) } : {}),
    ...(legacyAlien && Array.isArray(token.description)
      ? { description: token.description.map(upcastDescriptionLine) }
      : {}),
  };
}

function upcastDescriptionLine(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const line = raw as { params?: unknown };
  if (!line.params || typeof line.params !== 'object') return raw;
  return {
    ...line,
    params: Object.fromEntries(
      Object.entries(line.params).map(([key, value]) => [
        key,
        value === 'content.tokens.realm.god-executor' ? 'content.tokens.realm.alien' : value,
      ]),
    ),
  };
}
