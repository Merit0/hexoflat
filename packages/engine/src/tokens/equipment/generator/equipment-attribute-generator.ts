import { z } from 'zod';
import { tokenAttributeSchema, type TokenAttribute } from '../../token-schema';
import { ATTRIBUTE_STREAM_LABELS } from './attribute-streams';
import type {
  AttributeGenerationContext,
  IAttributeGenerator,
  IAttributePoolFilter,
  IAttributeProfileProvider,
  ICountRoller,
  IValueRoller,
  IWeightedPicker,
  PoolEntry,
} from './generator-contracts';

export interface EquipmentAttributeGeneratorParts {
  profiles: IAttributeProfileProvider;
  pool: IAttributePoolFilter;
  counts: ICountRoller;
  picker: IWeightedPicker;
  values: IValueRoller;
}

function generatedAttributesSchema(maxCount: number) {
  return z
    .array(tokenAttributeSchema)
    .max(maxCount)
    .refine(
      (attributes) =>
        new Set(attributes.map((attribute) => attribute.key)).size === attributes.length,
      'an attribute is generated twice',
    );
}

export class EquipmentAttributeGenerator implements IAttributeGenerator {
  constructor(private readonly parts: EquipmentAttributeGeneratorParts) {}

  generate(ctx: AttributeGenerationContext): TokenAttribute[] {
    const profile = this.parts.profiles.profileFor(ctx.level);
    const pool = this.parts.pool.poolFor({
      profile,
      group: ctx.group,
      type: ctx.type,
      allowedKeys: ctx.allowedKeys,
    });
    const count = this.parts.counts.roll(
      { countWeights: profile.countWeights, maxCount: profile.maxCount, poolSize: pool.length },
      ctx.rng(ATTRIBUTE_STREAM_LABELS.count(ctx.tokenId)),
    );
    const picked = this.pick(pool, count, ctx);
    return generatedAttributesSchema(profile.maxCount).parse(picked);
  }

  private pick(pool: readonly PoolEntry[], count: number, ctx: AttributeGenerationContext) {
    const remaining = [...pool];
    const picked: TokenAttribute[] = [];
    for (let index = 0; index < count; index += 1) {
      const chosen = this.parts.picker.pick(
        remaining.map((entry) => entry.weight),
        ctx.rng(ATTRIBUTE_STREAM_LABELS.pick(ctx.tokenId, index)),
      );
      if (chosen === null) break;
      const [entry] = remaining.splice(chosen, 1);
      const value = this.parts.values.roll(
        entry,
        ctx.rng(ATTRIBUTE_STREAM_LABELS.value(ctx.tokenId, entry.key)),
      );
      picked.push({ key: entry.key, value });
    }
    return picked;
  }
}
