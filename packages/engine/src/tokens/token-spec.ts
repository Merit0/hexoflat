import { z } from 'zod';
import { TOKEN_ATTRIBUTES } from '../content/token-attributes.content';
import { gameTokenFactory, isTokenType, tokenSourceIdOf } from './game-tokens';
import type { TokenResult } from './factory/token-generation';
import { baseRealmSchema, itemTypeKeySchema, mapTierSchema } from './token-keys';
import { tokenAttributeSchema, type ItemToken } from './token-schema';

const ATTRIBUTE_KEYS: ReadonlySet<string> = new Set(TOKEN_ATTRIBUTES.map((entry) => entry.key));

export const tokenSpecSchema = z.strictObject({
  type: itemTypeKeySchema.refine(isTokenType, 'not an item token type'),
  realm: baseRealmSchema,
  mapTier: mapTierSchema,
  attributes: z
    .array(
      tokenAttributeSchema.refine(
        (attribute) => ATTRIBUTE_KEYS.has(attribute.key),
        'unknown attribute',
      ),
    )
    .optional(),
  price: z.number().int().positive().optional(),
});
export type TokenSpec = z.infer<typeof tokenSpecSchema>;

export interface SpecMint {
  heroId: string;
  idSeq: number;
  amount: number;
}

export function mintSpecTokens(spec: TokenSpec, mint: SpecMint): TokenResult<ItemToken[]> {
  const sourceId = tokenSourceIdOf('dev', mint.heroId, String(mint.idSeq));
  const tokens: ItemToken[] = [];
  for (let n = 0; n < mint.amount; n += 1) {
    const result = gameTokenFactory().createBase(
      {
        seed: `grant:${mint.heroId}`,
        sourceId,
        n,
        realm: spec.realm,
        mapTier: spec.mapTier,
        type: spec.type,
      },
      { attributes: spec.attributes, price: spec.price },
    );
    if (!result.ok) return result;
    tokens.push(result.value);
  }
  return { ok: true, value: tokens };
}
