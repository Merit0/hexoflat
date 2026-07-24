import type { InventoryItem, TEquipSlot } from "@/stores/hero-inventory-store";
import { EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_META } from "@/registry/hexobject-meta";

export type TEquipCompatibility = "effect" | "mismatch";

function isHandSlot(slot: TEquipSlot) {
    return slot === "weapon" || slot === "shield";
}

function isEquipmentSlot(slot: TEquipSlot) {
    return (
        slot === "helm" ||
        slot === "armor" ||
        slot === "gloves" ||
        slot === "boots" ||
        slot === "ring" ||
        slot === "amulet"
    );
}

function canUseInHand(item: InventoryItem) {
    return (
        item.type !== EHexobjectGroup.CREATURE &&
        item.type !== EHexobjectGroup.CONSTRUCTION
    );
}

function isWearableEquipment(item: InventoryItem) {
    return item.type === EHexobjectGroup.EQUIPMENT;
}

export function resolveEquipCompatibility(
    item: InventoryItem | null,
    slot: TEquipSlot
): TEquipCompatibility {
    if (!item) return "mismatch";

    if (isHandSlot(slot)) {
        if (item.type === EHexobjectGroup.EQUIPMENT) {
            return HEXOBJECT_META[item.key]?.equip?.slot === slot ? "effect" : "mismatch";
        }

        return canUseInHand(item) ? "effect" : "mismatch";
    }

    if (isEquipmentSlot(slot)) {
        return isWearableEquipment(item) && HEXOBJECT_META[item.key]?.equip?.slot === slot
            ? "effect"
            : "mismatch";
    }

    return "mismatch";
}
