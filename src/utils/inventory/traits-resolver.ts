import type { TEquipSlot, TInventoryItemType } from "@/stores/hero-inventory-store";

// ВАЖЛИВО: Підстав свої правильні імпорти
import { HEXOBJECT_META } from "@/registry/hexobject-meta"; // якщо index.ts експортує
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";

// Якщо ти маєш aggregated prototypes index — підстав сюди.
// Напр.: import { ALL_PROTOTYPES } from "@/registry/hexobjects/prototypes";
import { LOOT_PROTOTYPES } from "@/registry/hexobjects/prototypes/loot.prototypes";
import { RESOURCE_PROTOTYPES } from "@/registry/hexobjects/prototypes/resources.prototypes";
// tools/equipment додаси пізніше

type ResolvedTraits = {
    stackable: boolean;
    stackKey?: string;
    weightKg: number;
    type: TInventoryItemType;
    equipSlot?: TEquipSlot;
    iconPath: string;
    title: string;
    description?: string;
};

export function resolveItemTraits(key: string): ResolvedTraits {
    const meta = (HEXOBJECT_META as any)?.[key];

    // 1) meta-first
    if (meta) {
        return {
            stackable: !!meta?.traits?.stackable,
            stackKey: meta?.traits?.stackKey,
            weightKg: meta?.traits?.weightKg ?? 0,
            type: (meta?.inventory?.type ?? "loot") as TInventoryItemType,
            equipSlot: meta?.equip?.slot as TEquipSlot | undefined,
            iconPath: meta?.iconPath ?? "",
            title: meta?.title ?? key,
            description: meta?.description ?? meta?.subtitle ?? "",
        };
    }

    // 2) fallback prototypes (мінімально, щоб уже працювало на твоїх LOOT_PROTOTYPES)
    const loot = (LOOT_PROTOTYPES as any)?.[key];
    if (loot) {
        return {
            stackable: !!loot?.loot?.traits?.stackable,
            stackKey: key,
            weightKg: loot?.loot?.traits?.weightKg ?? 0,
            type: "loot",
            equipSlot: undefined,
            iconPath: loot?.spritePath ?? "",
            title: loot?.loot?.name ?? key,
            description: loot?.description ?? "",
        };
    }

    const res = (RESOURCE_PROTOTYPES as any)?.[key];
    if (res) {
        // якщо ти реально хочеш дерево/камінь як токени, просто вмикай stackable в meta пізніше
        return {
            stackable: false,
            stackKey: undefined,
            weightKg: 0,
            type: "resource",
            equipSlot: undefined,
            iconPath: res?.spritePath ?? "",
            title: key,
            description: res?.description ?? "",
        };
    }

    // 3) safe default
    return {
        stackable: false,
        stackKey: undefined,
        weightKg: 0,
        type: "loot",
        equipSlot: undefined,
        iconPath: "",
        title: key,
        description: "",
    };
}