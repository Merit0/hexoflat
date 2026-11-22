import { sharedWithSchema } from '../dimensions/availability';
import { dimensionSchema } from '../dimensions/dimensions';
import { validateContentDimension } from './content-dimension';
import { tokenOriginSchema } from '../tokens/token-origin';
import { z } from 'zod';
import {
  EChestType,
  ERarityKind,
  EHexCollision,
  EHexobjectGroup,
} from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { MAX_EQUIPMENT_HEARTS } from '../combat/heart-slots';
import type { LocationKey } from '../registry/location-key';
import { LOCATION_KEYS } from '../registry/location-key';
import { TREASURE_SEEKER_MAP_KEY } from '../registry/quest-map-key';
import type { TToolKeys } from './tools.content';

const hexobjectKeys = Object.values(HEXOBJECT_KEYS) as [THexobjectKey, ...THexobjectKey[]];
export const hexobjectKeySchema = z.enum(hexobjectKeys);

export const actionDestinationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('WORLD'), locationKey: z.enum(LOCATION_KEYS) }),
  z.object({ type: z.literal('PORTAL') }),
  z.object({ type: z.literal('QUEST'), mapKey: z.literal(TREASURE_SEEKER_MAP_KEY) }),
  z.object({ type: z.literal('BATTLE') }),
]);

export type ActionDestination = z.infer<typeof actionDestinationSchema>;

const actionConfigSchema = z.object({
  label: z.string(),
  durationMs: z.number().optional(),
  requiredTool: hexobjectKeySchema.optional(),
  durabilityCostPct: z.number().optional(),
  willCost: z.number().int().min(0).max(5).optional(),
  destination: actionDestinationSchema.optional(),
});

const enterSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WORLD'),
    locationKey: z.string(),
  }),
  z.object({ type: z.literal('PORTAL') }),
]);

const healSchema = z.object({
  amountPerTick: z.number(),
  radius: z.number().optional(),
});

export const OBJECT_TAGS = [
  'resource',
  'treasure',
  'rare',
  'rest',
  'enemy',
  'portal',
  'blocker',
  'barrier',
  'challenge',
] as const;
export const objectTagSchema = z.enum(OBJECT_TAGS);
export type ObjectTag = z.infer<typeof objectTagSchema>;

const baseContentFields = {
  hexobjectKey: hexobjectKeySchema,
  dimension: dimensionSchema,
  sharedWith: sharedWithSchema.optional(),
  tags: z.array(objectTagSchema).optional(),
  isInteractable: z.boolean(),
  collision: z.enum(EHexCollision),
  spritePath: z.string().optional(),
  alwaysVisible: z.boolean().optional(),
  tileBackground: z.string().optional(),
  description: z.string().optional(),

  title: z.string(),
  subtitle: z.string().optional(),
  actions: z.record(z.string(), actionConfigSchema).optional(),
  yields: z.record(z.string(), z.number()).optional(),
  enter: enterSchema.optional(),
  heal: healSchema.optional(),
  coinPrice: z.number().int().positive().optional(),
};

const resourceSchema = z.object({
  isAvailable: z.boolean(),
  regrowMs: z.number().nullable().optional(),
  regrowAt: z.number().nullable().optional(),
  amount: z.number().optional(),
  maxAmount: z.number(),
  requiredToolKey: hexobjectKeySchema.nullable().optional(),
  traits: z.object({
    cuttable: z.boolean().optional(),
    mineable: z.boolean().optional(),
    pickable: z.boolean().optional(),
  }),
});

const raritySchema = z.object({
  kind: z.enum(ERarityKind),
  boss: z.boolean().default(false),
});

const lootSchema = z.object({
  name: z.string(),
  amount: z.number().optional(),
  rarity: raritySchema.optional(),
  usePrice: z.number().int().positive().optional(),
  traits: z.object({
    stackable: z.boolean().optional(),
    maxStack: z.number().optional(),
    stackKey: hexobjectKeySchema,
    weightKG: z.number(),
  }),
});

export const squadSchema = z.object({
  members: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  watcher: z.boolean(),
  boss: z.boolean(),
  battlefieldBiome: z.enum(['crypt']),
  tableRule: z.string(),
});

const creatureSchema = z.object({
  name: z.string(),
  hp: z.number(),
  hpMax: z.number(),
  attack: z.number(),
  faction: z.enum(['neutral', 'enemy', 'friendly']).optional(),
  visionRange: z.number().optional(),
  squad: squadSchema.optional(),
});

const toolSchema = z.object({
  durability: z.number(),
  durabilityMax: z.number(),
  attackMultiplier: z.number().optional(),
  defense: z.number().optional(),
  rarity: raritySchema.optional(),
  capabilities: z.object({
    canPickup: z.boolean().optional(),
    canEnter: z.boolean().optional(),
    canUse: z.boolean().optional(),
    canOpen: z.boolean().optional(),
    canAttack: z.boolean().optional(),
    canBlock: z.boolean().optional(),
    canScout: z.boolean().optional(),
  }),
  traits: z.object({ weightKG: z.number() }),
});

const constructionSchema = z.object({
  integrity: z.number(),
  isLocked: z.boolean().optional(),
  chestType: z.enum(EChestType).optional(),
  lootTableId: z.string().min(1).optional(),
});

const weaponSchema = z.object({
  attackMultiplier: z.number().optional(),
  radius: z.number().int().min(1).optional(),
});

const equipmentSchema = z.object({
  durability: z.number(),
  durabilityMax: z.number(),
  defense: z.number().optional(),
  hearts: z.number().int().min(0).max(MAX_EQUIPMENT_HEARTS).optional(),
  rarity: raritySchema.optional(),
  capabilities: z
    .object({
      canAttack: z.boolean().optional(),
      canBlock: z.boolean().optional(),
    })
    .optional(),
  traits: z.object({ weightKG: z.number().optional() }).optional(),
});

const ResourceContentSchema = z.object({
  ...baseContentFields,
  groupType: z.literal(EHexobjectGroup.RESOURCE),
  resource: resourceSchema,
});

const LootContentSchema = z.object({
  ...baseContentFields,
  groupType: z.literal(EHexobjectGroup.LOOT),
  loot: lootSchema,
});

const CreatureContentSchema = z.object({
  ...baseContentFields,
  groupType: z.literal(EHexobjectGroup.CREATURE),
  creature: creatureSchema,
});

const ToolContentSchema = z.object({
  ...baseContentFields,
  groupType: z.literal(EHexobjectGroup.TOOL),
  tool: toolSchema,
});

const ConstructionContentSchema = z.object({
  ...baseContentFields,
  groupType: z.literal(EHexobjectGroup.CONSTRUCTION),
  construction: constructionSchema,
});

const EquipmentContentSchema = z.object({
  ...baseContentFields,
  groupType: z.literal(EHexobjectGroup.EQUIPMENT),
  equipment: equipmentSchema,
  weapon: weaponSchema.optional(),
});

export const ContentDefinitionSchema = z
  .discriminatedUnion('groupType', [
    ResourceContentSchema,
    LootContentSchema,
    CreatureContentSchema,
    ToolContentSchema,
    ConstructionContentSchema,
    EquipmentContentSchema,
  ])
  .superRefine(validateContentDimension);

export type TContentDefinition = z.infer<typeof ContentDefinitionSchema>;

const traderStockRangeSchema = z
  .object({
    key: hexobjectKeySchema,
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .strict();

export const traderDefinitionSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    line: z.string(),
    portraitPath: z.string(),
    stallHexobjectKey: hexobjectKeySchema,
    sellRate: z
      .object({ num: z.number().int().positive(), den: z.number().int().positive() })
      .strict(),
    tokenOrigin: tokenOriginSchema.optional(),
    goodsSlots: z.number().int().positive(),
    buybackSlots: z.number().int().positive(),
    refresh: z
      .object({ baseWill: z.number().int().positive(), factor: z.number().int().min(1) })
      .strict(),
    guaranteed: z.array(traderStockRangeSchema),
    pool: z.array(traderStockRangeSchema.extend({ weight: z.number().int().positive() }).strict()),
    rolls: z.number().int().nonnegative(),
    discounts: z
      .object({
        chancePct: z.number().int().min(0).max(100),
        percents: z.array(z.number().int().min(1).max(99)).min(1),
        maxGoods: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type TTraderDefinition = z.infer<typeof traderDefinitionSchema>;

export type THexYieldKey = 'wood' | 'coins' | 'stone';
export type THexYields = Partial<Record<THexYieldKey, number>> & {
  [key: string]: number | undefined;
};

export interface IHexobjectMeta {
  key: THexobjectKey;
  title: string;
  subtitle?: string;
  actions?: Partial<
    Record<
      EHexActionType,
      {
        label: string;
        durationMs?: number;
        requiredTool?: TToolKeys;
        durabilityCostPct?: number;
        willCost?: number;
        destination?: ActionDestination;
      }
    >
  >;
  traits?: {
    stackable?: boolean;
    stackKey?: string;
    maxStack?: number;
    weightKG?: number;
  };
  yields?: THexYields;
  enter?: { type: 'WORLD'; locationKey: LocationKey } | { type: 'PORTAL' };
  heal?: { amountPerTick: number; radius?: number };
}
