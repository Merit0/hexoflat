import type { BaseItemRegistry } from '../base-item-registry';
import { currentItemTokenSchema, type ItemToken } from '../token-schema';
import {
  refuseToken,
  type AttributeSheet,
  type ITokenValidator,
  type TokenResult,
} from './token-generation';
import { attributeFailure, dependencyFailure } from '../attribute-rules';
import type { AttributeProfiles } from '../equipment/attribute-profile-schema';
import type { AttributeRegistry, TypeRegistry } from '../registries';
import { mapTierSchema } from '../token-keys';

const MAX_BLOCK_SIDES = 6;
const BLOCK_ATTRIBUTE_KEY = 'shield';

export class ZodTokenValidator implements ITokenValidator {
  constructor(
    private readonly types: TypeRegistry,
    private readonly attributes: AttributeRegistry,
    private readonly profiles: AttributeProfiles,
    private readonly bases: BaseItemRegistry,
  ) {}

  validateAttributes(sheet: AttributeSheet): TokenResult<true> {
    if (!mapTierSchema.safeParse(sheet.mapTier).success)
      return refuseToken('INVALID_TOKEN', 'Invalid source tier');
    const check =
      sheet.origin === 'base'
        ? { origin: 'base' as const, profiles: this.profiles }
        : { origin: 'unique' as const };
    const maxCount = this.profiles[`tier-${sheet.mapTier}`].maxCount;
    if (sheet.origin === 'base' && sheet.attributes.length > maxCount) {
      return refuseToken('INVALID_TOKEN', 'Too many base token attributes');
    }
    for (const attribute of sheet.attributes) {
      const failure = attributeFailure(
        this.attributes,
        sheet.type,
        attribute,
        check,
        sheet.mapTier,
      );
      if (failure) return refuseToken('INVALID_TOKEN', failure);
    }
    const missing = dependencyFailure(this.attributes, sheet.attributes);
    if (missing) return refuseToken('INVALID_TOKEN', missing);
    const sides =
      (sheet.type.block?.sides ?? 0) +
      sheet.attributes
        .filter((attribute) => attribute.key === BLOCK_ATTRIBUTE_KEY)
        .reduce((sum, attribute) => sum + attribute.value, 0);
    if (sides > MAX_BLOCK_SIDES)
      return refuseToken('INVALID_TOKEN', 'A shield cannot exceed six block sides');
    return { ok: true, value: true };
  }

  validate(candidate: unknown): TokenResult<ItemToken> {
    const parsed = currentItemTokenSchema.safeParse(candidate);
    if (parsed.success) {
      const token = parsed.data;
      if (!this.types.has(token.type)) return refuseToken('INVALID_TOKEN', 'Unknown token type');
      if (token.origin === 'base') {
        const base = this.bases.get(token.baseKey!);
        if (!base || base.dimension !== token.dimension || base.type !== token.type)
          return refuseToken('INVALID_TOKEN', 'Invalid concrete base item identity');
        if (
          base.attributes &&
          token.attributes.some((entry) => !base.attributes!.includes(entry.key))
        )
          return refuseToken('INVALID_TOKEN', 'Attribute is outside the base item pool');
      }
      const checked = this.validateAttributes({
        type: this.types.get(token.type),
        origin: token.origin,
        mapTier: token.mapTier,
        attributes: token.attributes,
      });
      return checked.ok ? { ok: true, value: token } : checked;
    }
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return refuseToken('INVALID_TOKEN', issues.join('; '));
  }
}
