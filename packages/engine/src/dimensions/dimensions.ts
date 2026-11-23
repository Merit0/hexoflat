import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { z } from 'zod';

export enum EDimension {
  HEAVEN = 'heaven',
  EARTH = 'earth',
  UNDERWORLD = 'underworld',
  NOWHERE = 'nowhere',
}

export const dimensionSchema = z.enum(EDimension);
export const itemFamilySchema = z.enum(ERarityKind);
export type TItemFamily = z.infer<typeof itemFamilySchema>;

export const TOKEN_TIERS = ['base', 'unique'] as const;
export type TTokenTier = (typeof TOKEN_TIERS)[number];

export const priceRangeSchema = z
  .tuple([z.number().int().positive(), z.number().int().positive()])
  .refine(([min, max]) => min <= max, 'min is above max');
export type PriceRange = z.infer<typeof priceRangeSchema>;

const lightSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+$/),
  color: z.string().regex(/^#[0-9A-F]{6}$/),
});
export interface DimensionLight {
  readonly id: string;
  readonly color: string;
}

export type TierPrice =
  | { readonly kind: 'range'; readonly range: readonly [number, number] }
  | { readonly kind: 'manual' };

const tierPriceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('range'), range: priceRangeSchema }),
  z.strictObject({ kind: z.literal('manual') }),
]);

const tierConfigSchema = z.strictObject({
  light: lightSchema,
  price: tierPriceSchema,
  sortRank: z.number().int().nonnegative(),
});

const dimensionConfigSchema = z.strictObject({
  tokenType: itemFamilySchema,
  tiers: z
    .strictObject({ base: tierConfigSchema.optional(), unique: tierConfigSchema.optional() })
    .refine((tiers) => TOKEN_TIERS.some((tier) => tiers[tier]), 'a dimension needs a tier')
    .refine((tiers) => !tiers.base || tiers.base.price.kind === 'range', {
      message: 'a base tier is priced by a range',
    })
    .refine((tiers) => !tiers.unique || tiers.unique.price.kind === 'manual', {
      message: 'a unique tier is priced by its definition',
    }),
});

function distinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const dimensionConfigRecordSchema = z
  .record(dimensionSchema, dimensionConfigSchema)
  .refine((record) => distinct(Object.values(record).map((config) => config.tokenType)), {
    message: 'a token type belongs to two dimensions',
  })
  .refine(
    (record) =>
      distinct(
        Object.values(record).flatMap((config) =>
          TOKEN_TIERS.flatMap((tier) => config.tiers[tier]?.light.id ?? []),
        ),
      ),
    { message: 'a light is used twice' },
  )
  .refine(
    (record) =>
      distinct(
        Object.values(record).flatMap((config) =>
          TOKEN_TIERS.flatMap((tier) => {
            const rank = config.tiers[tier]?.sortRank;
            return rank === undefined ? [] : [String(rank)];
          }),
        ),
      ),
    { message: 'a sort rank is used twice' },
  );

interface TierShape {
  readonly light: DimensionLight;
  readonly price: TierPrice;
  readonly sortRank: number;
}

interface DimensionShape {
  readonly tokenType: TItemFamily;
  readonly tiers: { readonly base?: TierShape; readonly unique?: TierShape };
}

const DIMENSION_CONFIG = {
  [EDimension.UNDERWORLD]: {
    tokenType: ERarityKind.GLOOM,
    tiers: {
      base: {
        light: { id: 'blue', color: '#3E8BFF' },
        price: { kind: 'range', range: [60, 800] },
        sortRank: 5,
      },
      unique: {
        light: { id: 'violet', color: '#A855F7' },
        price: { kind: 'manual' },
        sortRank: 2,
      },
    },
  },
  [EDimension.EARTH]: {
    tokenType: ERarityKind.IDOL,
    tiers: {
      base: {
        light: { id: 'gray', color: '#A9AEB4' },
        price: { kind: 'range', range: [40, 600] },
        sortRank: 6,
      },
      unique: {
        light: { id: 'green', color: '#4FD27A' },
        price: { kind: 'manual' },
        sortRank: 3,
      },
    },
  },
  [EDimension.HEAVEN]: {
    tokenType: ERarityKind.SPARK,
    tiers: {
      base: {
        light: { id: 'yellow', color: '#F5D33B' },
        price: { kind: 'range', range: [100, 1200] },
        sortRank: 4,
      },
      unique: {
        light: { id: 'orange', color: '#FF8A2A' },
        price: { kind: 'manual' },
        sortRank: 1,
      },
    },
  },
  [EDimension.NOWHERE]: {
    tokenType: ERarityKind.ALIEN,
    tiers: {
      unique: { light: { id: 'red', color: '#FF3B3B' }, price: { kind: 'manual' }, sortRank: 0 },
    },
  },
} as const satisfies Record<EDimension, DimensionShape>;

type DimensionConfigs = typeof DIMENSION_CONFIG;
type TierKey<D extends EDimension> = keyof DimensionConfigs[D]['tiers'] & TTokenTier;
type TierConfig<D extends EDimension, T extends TierKey<D>> = DimensionConfigs[D]['tiers'][T];
type ConfigOfTier = { light: { id: string }; price: unknown };

export type TTokenTypeWithTier<T extends TTokenTier> = {
  [D in EDimension]: T extends TierKey<D> ? DimensionConfigs[D]['tokenType'] : never;
}[EDimension];

export type TDimensionLightId = {
  [D in EDimension]: {
    [T in TierKey<D>]: TierConfig<D, T> extends ConfigOfTier
      ? TierConfig<D, T>['light']['id']
      : never;
  }[TierKey<D>];
}[EDimension];

export type TTierTone = {
  [D in EDimension]: `${DimensionConfigs[D]['tokenType']}-${TierKey<D>}`;
}[EDimension];

export type TTierToneName = {
  [D in EDimension]: 'base' extends TierKey<D>
    ? {
        base: `${DimensionConfigs[D]['tokenType']}`;
        unique: `${DimensionConfigs[D]['tokenType']}-boss`;
      }[TierKey<D>]
    : `${DimensionConfigs[D]['tokenType']}`;
}[EDimension];

dimensionConfigRecordSchema.parse(DIMENSION_CONFIG);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Ownership is independent of board construction and current location. */
export const DIMENSIONS: DimensionConfigs = deepFreeze(DIMENSION_CONFIG);

export interface DimensionTierView {
  dimension: EDimension;
  tokenType: TItemFamily;
  tier: TTokenTier;
  light: TierLight;
  price: TierPrice;
  sortRank: number;
}

export interface TierLight {
  readonly id: TDimensionLightId;
  readonly color: string;
}

function tierConfigOf(dimension: EDimension, tier: TTokenTier) {
  const tiers: DimensionShape['tiers'] = DIMENSIONS[dimension].tiers;
  return tiers[tier];
}

/** Every dimension × allowed tier in record order (dimension, then base before unique). */
export const DIMENSION_TIERS: readonly DimensionTierView[] = Object.freeze(
  (Object.keys(DIMENSIONS) as EDimension[]).flatMap((dimension) =>
    TOKEN_TIERS.flatMap((tier) => {
      const config = tierConfigOf(dimension, tier);
      if (!config) return [];
      return [
        Object.freeze({
          dimension,
          tokenType: DIMENSIONS[dimension].tokenType,
          tier,
          light: config.light as TierLight,
          price: config.price,
          sortRank: config.sortRank,
        }),
      ];
    }),
  ),
);

export function tiersOfDimension(dimension: EDimension): readonly TTokenTier[] {
  return TOKEN_TIERS.filter((tier) => tierConfigOf(dimension, tier) !== undefined);
}

export function dimensionAllowsTier(dimension: EDimension, tier: TTokenTier): boolean {
  return tierConfigOf(dimension, tier) !== undefined;
}

export function tokenTierView(tokenType: string, tier: TTokenTier): DimensionTierView | null {
  return (
    DIMENSION_TIERS.find(
      (view) => (view.tokenType as string) === tokenType && view.tier === tier,
    ) ?? null
  );
}

export function tokenTypeAllowsTier(tokenType: string, tier: TTokenTier): boolean {
  return tokenTierView(tokenType, tier) !== null;
}

export function tiersOfTokenType(tokenType: string): readonly TTokenTier[] {
  return TOKEN_TIERS.filter((tier) => tokenTypeAllowsTier(tokenType, tier));
}

export function tokenTypesWithTier<T extends TTokenTier>(
  tier: T,
): readonly TTokenTypeWithTier<T>[] {
  return DIMENSION_TIERS.filter((view) => view.tier === tier).map(
    (view) => view.tokenType as TTokenTypeWithTier<T>,
  );
}

export const TOKEN_TYPES: readonly TItemFamily[] = Object.freeze(
  Object.values(DIMENSIONS).map((config) => config.tokenType),
);

export function itemFamilyOfDimension(dimension: EDimension): TItemFamily {
  return DIMENSIONS[dimensionSchema.parse(dimension)].tokenType;
}

export function dimensionOfItemFamily(family: TItemFamily): EDimension {
  const parsed = itemFamilySchema.parse(family);
  const dimension = Object.values(EDimension).find(
    (owner) => DIMENSIONS[owner].tokenType === parsed,
  );
  if (!dimension) throw new Error(`Unknown item family: ${parsed}`);
  return dimension;
}
