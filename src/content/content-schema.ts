import { z } from "zod";
import { EHexCollision, EHexobjectGroup, EQUIP_SLOTS, type TEquipSlot } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_KEYS, type THexobjectKey } from "@/registry/hexobjects-registry";
import { EHexActionType } from "@/enums/hex-action-type";
import type { LocationKey } from "@/registry/location-key";
import type { TToolKeys } from "./tools.content";

const hexobjectKeys = Object.values(HEXOBJECT_KEYS) as [THexobjectKey, ...THexobjectKey[]];
export const hexobjectKeySchema = z.enum(hexobjectKeys);

const actionConfigSchema = z.object({
    label: z.string(),
    durationMs: z.number().optional(),
    requiredTool: hexobjectKeySchema.optional(),
    durabilityCostPct: z.number().optional(),
});

const enterSchema = z.object({
    type: z.literal("WORLD"),
    // Loose on purpose: LocationKey lives in world-map-registry.ts, which pulls in
    // rendering code, and content must stay framework-agnostic.
    locationKey: z.string(),
});

const baseContentFields = {
    hexobjectKey: hexobjectKeySchema,
    isInteractable: z.boolean(),
    collision: z.nativeEnum(EHexCollision),
    spritePath: z.string().optional(),
    description: z.string().optional(),

    title: z.string(),
    subtitle: z.string().optional(),
    actions: z.record(z.string(), actionConfigSchema).optional(),
    yields: z.record(z.string(), z.number()).optional(),
    equip: z.object({ slot: z.enum(EQUIP_SLOTS) }).optional(),
    enter: enterSchema.optional(),
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

const lootSchema = z.object({
    name: z.string(),
    amount: z.number().optional(),
    traits: z.object({
        stackable: z.boolean().optional(),
        maxStack: z.number().optional(),
        stackKey: hexobjectKeySchema,
        weightKG: z.number(),
    }),
});

const creatureSchema = z.object({
    name: z.string(),
    hp: z.number(),
    hpMax: z.number(),
    attack: z.number(),
    faction: z.enum(["neutral", "enemy", "friendly"]).optional(),
    visionRange: z.number().optional(),
});

const toolSchema = z.object({
    durability: z.number(),
    durabilityMax: z.number(),
    attackMultiplier: z.number().optional(),
    defense: z.number().optional(),
    capabilities: z.object({
        canCut: z.boolean().optional(),
        canMine: z.boolean().optional(),
        canPickup: z.boolean().optional(),
        canEnter: z.boolean().optional(),
        canUse: z.boolean().optional(),
        canAttack: z.boolean().optional(),
        canBlock: z.boolean().optional(),
    }),
    traits: z.object({ weightKG: z.number() }),
});

const constructionSchema = z.object({
    integrity: z.number(),
    isLocked: z.boolean().optional(),
});

const weaponSchema = z.object({
    damageMin: z.number(),
    damageMax: z.number(),
    attackMultiplier: z.number().optional(),
});

const equipmentSchema = z.object({
    durability: z.number(),
    durabilityMax: z.number(),
    defense: z.number().optional(),
    capabilities: z.object({
        canAttack: z.boolean().optional(),
        canBlock: z.boolean().optional(),
    }).optional(),
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

export const ContentDefinitionSchema = z.discriminatedUnion("groupType", [
    ResourceContentSchema,
    LootContentSchema,
    CreatureContentSchema,
    ToolContentSchema,
    ConstructionContentSchema,
    EquipmentContentSchema,
]);

export type TContentDefinition = z.infer<typeof ContentDefinitionSchema>;

export type THexYieldKey = "wood" | "coins" | "stone";
export type THexYields = Partial<Record<THexYieldKey, number>> & {
    [key: string]: number | undefined;
};

export interface IHexobjectMeta {
    key: THexobjectKey;
    title: string;
    subtitle?: string;
    actions?: Partial<Record<EHexActionType, {
        label: string;
        durationMs?: number;
        requiredTool?: TToolKeys;
        durabilityCostPct?: number;
    }>>;
    traits?: {
        stackable?: boolean;
        stackKey?: string;
        maxStack?: number;
        weightKG?: number;
    };
    equip?: { slot: TEquipSlot };
    yields?: THexYields;
    enter?: { type: "WORLD"; locationKey: LocationKey };
}