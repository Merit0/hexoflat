import { itemTokenSchema, type ItemToken } from '../token-schema';
import {
  refuseToken,
  type ITokenValidator,
  type TokenResult,
  type TokenSheet,
} from './token-generation';
import { attributeFailure } from '../attribute-rules';
import type { AttributeRegistry, TypeRegistry } from '../registries';
import { mapTierSchema } from '../token-keys';
import { MAX_BASE_TOKEN_ATTRIBUTES } from './attribute-generator';

export class ZodTokenValidator implements ITokenValidator {
  constructor(
    private readonly types: TypeRegistry,
    private readonly attributes: AttributeRegistry,
  ) {}

  validateAttributes(
    sheet: Pick<TokenSheet, 'type' | 'mapTier' | 'attributes'>,
  ): TokenResult<true> {
    if (!mapTierSchema.safeParse(sheet.mapTier).success)
      return refuseToken('INVALID_TOKEN', 'Invalid source tier');
    for (const attribute of sheet.attributes) {
      const failure = attributeFailure(this.attributes, sheet.type.key, attribute, sheet.mapTier);
      if (failure) return refuseToken('INVALID_TOKEN', failure);
    }
    const sides =
      (sheet.type.block?.sides ?? 0) +
      sheet.attributes
        .filter((attribute) => attribute.key === 'shield')
        .reduce((sum, attribute) => sum + attribute.value, 0);
    if (sides > 6) return refuseToken('INVALID_TOKEN', 'A shield cannot exceed six block sides');
    return { ok: true, value: true };
  }

  validate(candidate: unknown): TokenResult<ItemToken> {
    const parsed = itemTokenSchema.safeParse(candidate);
    if (parsed.success) {
      const token = parsed.data;
      if (token.origin === 'base' && token.attributes.length > MAX_BASE_TOKEN_ATTRIBUTES) {
        return refuseToken('INVALID_TOKEN', 'Too many base token attributes');
      }
      if (!this.types.has(token.type)) return refuseToken('INVALID_TOKEN', 'Unknown token type');
      const checked = this.validateAttributes({
        type: this.types.get(token.type),
        mapTier: token.mapTier,
        attributes: token.attributes,
      });
      return checked.ok ? { ok: true, value: token } : checked;
    }
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return refuseToken('INVALID_TOKEN', issues.join('; '));
  }
}
