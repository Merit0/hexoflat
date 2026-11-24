import { z } from 'zod';

export const DIMENSION_MECHANICS = [
  'drop-world',
  'matrix-card',
  'unique-roll',
  'alien-roll',
  'buy-back',
  'hero-origin',
] as const;
export type TDimensionMechanic = (typeof DIMENSION_MECHANICS)[number];

const dimensionRuleSchema = z.strictObject({
  id: z.enum(DIMENSION_MECHANICS),
  tableRule: z.string().regex(/^content\.dimension\.[a-z-]+\.tableRule$/),
});
export type DimensionRule = z.infer<typeof dimensionRuleSchema>;

export const dimensionRulesSchema = z.record(z.enum(DIMENSION_MECHANICS), dimensionRuleSchema);

function rule(id: TDimensionMechanic): DimensionRule {
  return { id, tableRule: `content.dimension.${id}.tableRule` };
}

export const DIMENSION_RULES: Readonly<Record<TDimensionMechanic, DimensionRule>> =
  dimensionRulesSchema.parse({
    'drop-world': rule('drop-world'),
    'matrix-card': rule('matrix-card'),
    'unique-roll': rule('unique-roll'),
    'alien-roll': rule('alien-roll'),
    'buy-back': rule('buy-back'),
    'hero-origin': rule('hero-origin'),
  });
