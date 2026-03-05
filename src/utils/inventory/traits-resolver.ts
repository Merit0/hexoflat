import { THexobjectKey } from "@/registry/hexobjects-registry";
import { HEX_OBJECT_PROTOTYPES } from "@/registry/hexobjects/prototypes";
import { HEXOBJECT_META } from "@/registry/hexobject-meta";
import { EHexobjectGroup, THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { assertNever } from "@/utils/assert-never";
import { TEquipSlot } from "@/stores/hero-inventory-store";

export type ResolvedInventoryView = {
    group: EHexobjectGroup;
    iconPath: string;

    title: string;
    description: string;

    stackable: boolean;
    stackKey?: string;
    defaultAmount: number;

    equipSlot?: TEquipSlot;
    weightKg: number;
};

function resolveProtoFields(proto: THexobjectPrototype) {
    const group = proto.groupType;
    const iconPath = proto.spritePath ?? "";
    const descriptionFallback = proto.description ?? "";

    // defaults
    let stackable = false;
    let defaultAmount = 1;
    let weightKg = 0;
    let equipSlot: TEquipSlot | undefined = undefined;
    let stackKey: string | undefined = undefined;

    switch (proto.groupType) {
        case EHexobjectGroup.LOOT: {
            stackable = !!proto.loot.traits?.stackable;
            defaultAmount = proto.loot.amount ?? 1;
            // якщо захочеш stackKey/weight в loot.traits — додаси й тут
            break;
        }

        case EHexobjectGroup.RESOURCE: {
            // ресурси як токени: можна defaultAmount = resource.amount ?? 1
            defaultAmount = proto.resource.amount ?? 1;
            break;
        }

        case EHexobjectGroup.TOOL: {
            // tools як інвентарні токени (не стак)
            defaultAmount = 1;
            // якщо вага є в equipment/tool пізніше — додаси
            break;
        }

        case EHexobjectGroup.WEAPON: {
            defaultAmount = 1;
            // slot беремо з факту "weapon => equip slot weapon"
            equipSlot = "weapon" as TEquipSlot; // або якщо у вас є строгий тип слотів — поставимо точно
            // якщо вага живе в equipment.traits, можна додати
            // weightKg = proto.equipment.traits?.weightKg ?? 0;  // якщо додаси поле
            break;
        }

        case EHexobjectGroup.CREATURE: {
            defaultAmount = 1;
            break;
        }

        case EHexobjectGroup.CONSTRUCTION: {
            defaultAmount = 1;
            break;
        }

        default:
            assertNever(proto, "Unhandled proto.groupType");
    }

    return { group, iconPath, descriptionFallback, stackable, stackKey, defaultAmount, equipSlot, weightKg };
}

export function resolveInventoryView(key: THexobjectKey): ResolvedInventoryView {
    const proto = HEX_OBJECT_PROTOTYPES[key];
    const meta = HEXOBJECT_META[key];

    // proto is required by satisfies Record<THexobjectKey,...>
    // але якщо колись буде partial — зробимо страховку:
    if (!proto) {
        return {
            group: EHexobjectGroup.LOOT,
            iconPath: "",
            title: key,
            description: "",
            stackable: false,
            stackKey: undefined,
            defaultAmount: 1,
            equipSlot: undefined,
            weightKg: 0,
        };
    }

    const p = resolveProtoFields(proto);

    // meta overrides (UI + optional traits)
    const title = meta?.title ?? key;
    const description = meta?.subtitle ?? meta?.title ?? p.descriptionFallback;

    // stack rules — якщо ти вирішив тримати stackable/stackKey в meta.traits, просто перезапиши
    const metaStackable = !!meta?.traits?.stackable;
    const stackable = meta?.traits ? metaStackable : p.stackable;
    const stackKey = meta?.traits?.stackKey ?? (stackable ? key : undefined);

    // weightKg: якщо вага буде в meta.traits — можна зробити так само
    const weightKg = meta?.traits?.weightKg ?? p.weightKg;

    return {
        group: p.group,
        iconPath: p.iconPath,
        title,
        description,
        stackable,
        stackKey,
        defaultAmount: p.defaultAmount,
        equipSlot: p.equipSlot,
        weightKg,
    };
}