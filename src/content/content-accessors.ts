import { EHexobjectGroup, type THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import type { THexobjectKey } from "@/registry/hexobjects-registry";
import { assertNever } from "@/utils/assert-never";
import { CONTENT } from "./content-map";
import type { IHexobjectMeta, TContentDefinition } from "./content-schema";

export function getPrototype(key: THexobjectKey): THexobjectPrototype {
    const content = CONTENT[key];
    if (!content) throw new Error(`Unknown Hexobject key: [ ${key} ]`);

    const base = {
        hexobjectKey: content.hexobjectKey,
        isInteractable: content.isInteractable,
        collision: content.collision,
        spritePath: content.spritePath,
        description: content.description,
    };

    switch (content.groupType) {
        case EHexobjectGroup.RESOURCE:
            return { ...base, groupType: content.groupType, resource: content.resource };
        case EHexobjectGroup.LOOT:
            return { ...base, groupType: content.groupType, loot: content.loot };
        case EHexobjectGroup.CREATURE:
            return { ...base, groupType: content.groupType, creature: content.creature };
        case EHexobjectGroup.TOOL:
            return { ...base, groupType: content.groupType, tool: content.tool };
        case EHexobjectGroup.CONSTRUCTION:
            return { ...base, groupType: content.groupType, construction: content.construction };
        case EHexobjectGroup.EQUIPMENT:
            return { ...base, groupType: content.groupType, equipment: content.equipment, weapon: content.weapon };
        default:
            return assertNever(content, "Unhandled content.groupType in getPrototype");
    }
}

function deriveMetaTraits(content: TContentDefinition): IHexobjectMeta["traits"] {
    switch (content.groupType) {
        case EHexobjectGroup.LOOT:
            return content.loot.traits;
        case EHexobjectGroup.TOOL:
            return { weightKG: content.tool.traits.weightKG };
        case EHexobjectGroup.EQUIPMENT:
            return content.equipment.traits ? { weightKG: content.equipment.traits.weightKG } : undefined;
        case EHexobjectGroup.RESOURCE:
        case EHexobjectGroup.CREATURE:
        case EHexobjectGroup.CONSTRUCTION:
            return undefined;
        default:
            return assertNever(content, "Unhandled content.groupType in deriveMetaTraits");
    }
}

export function getMeta(key: THexobjectKey): IHexobjectMeta {
    const content = CONTENT[key];
    if (!content) throw new Error(`Unknown Hexobject key: [ ${key} ]`);

    return {
        key: content.hexobjectKey,
        title: content.title,
        subtitle: content.subtitle,
        actions: content.actions as IHexobjectMeta["actions"],
        traits: deriveMetaTraits(content),
        equip: content.equip,
        yields: content.yields,
        enter: content.enter as IHexobjectMeta["enter"],
    };
}