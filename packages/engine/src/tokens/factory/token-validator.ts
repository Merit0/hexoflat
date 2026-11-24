import { availableInDimension } from '../../dimensions/availability';
import type { BaseItemRegistry } from '../base-item-registry';
import { currentItemTokenSchema, type ItemToken } from '../token-schema';
import {
  refuseToken,
  type AttributeSheet,
  type ITokenValidator,
  type TokenResult,
} from './token-generation';
import { attributeFailure, attributeSetFailure, type AttributeCheck } from '../attribute-rules';
import type { AttributeProfiles } from '../equipment/attribute-profile-schema';
import type { AttributeRegistry, TypeRegistry, UniqueRegistry } from '../registries';
import { mapTierSchema } from '../token-keys';

export interface UniqueValidation {
  uniques: UniqueRegistry;
  profiles: AttributeProfiles;
}

export class ZodTokenValidator implements ITokenValidator {
  constructor(
    private readonly types: TypeRegistry,
    private readonly attributes: AttributeRegistry,
    private readonly profiles: AttributeProfiles,
    private readonly bases: BaseItemRegistry,
    private readonly unique: UniqueValidation,
  ) {}

  validateAttributes(sheet: AttributeSheet): TokenResult<true> {
    if (!mapTierSchema.safeParse(sheet.mapTier).success)
      return refuseToken('INVALID_TOKEN', 'Invalid source tier');
    const authored = sheet.authored ?? [];
    const check: AttributeCheck =
      sheet.tier === 'base'
        ? { tier: 'base', profiles: this.profiles }
        : { tier: 'unique', profiles: this.unique.profiles, authored };
    const missing = authored.filter(
      (entry) => !sheet.attributes.some((attribute) => attribute.key === entry.attribute),
    );
    if (missing.length > 0) {
      return refuseToken('INVALID_TOKEN', `Authored attribute ${missing[0].attribute} is missing`);
    }
    const { maxCount } = check.profiles[`tier-${sheet.mapTier}`];
    if (sheet.attributes.length - authored.length > maxCount) {
      return refuseToken('INVALID_TOKEN', `Too many ${sheet.tier} token attributes`);
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
    const combined = attributeSetFailure(this.attributes, sheet.type, sheet.attributes);
    if (combined) return refuseToken('INVALID_TOKEN', combined);
    return { ok: true, value: true };
  }

  validate(candidate: unknown): TokenResult<ItemToken> {
    const parsed = currentItemTokenSchema.safeParse(candidate);
    if (parsed.success) {
      const token = parsed.data;
      if (!this.types.has(token.type)) return refuseToken('INVALID_TOKEN', 'Unknown token type');
      if (token.tier === 'base') {
        const base = this.bases.get(token.baseKey!);
        if (!base || !availableInDimension(base, token.dimension) || base.type !== token.type)
          return refuseToken('INVALID_TOKEN', 'Invalid concrete base item identity');
        if (
          base.attributes &&
          token.attributes.some((entry) => !base.attributes!.includes(entry.key))
        )
          return refuseToken('INVALID_TOKEN', 'Attribute is outside the base item pool');
      }
      if (token.tier === 'unique' && !this.unique.uniques.has(token.uniqueKey!))
        return refuseToken('INVALID_TOKEN', 'Unknown unique template');
      const checked = this.validateAttributes({
        type: this.types.get(token.type),
        tier: token.tier,
        mapTier: token.mapTier,
        attributes: token.attributes,
        authored:
          token.tier === 'unique'
            ? this.unique.uniques.get(token.uniqueKey!).authoredAttributes
            : [],
      });
      return checked.ok ? { ok: true, value: token } : checked;
    }
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return refuseToken('INVALID_TOKEN', issues.join('; '));
  }
}
