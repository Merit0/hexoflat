import {LootItemModel} from "@/models/LootItemModel";
import {WeaponProvider} from "@/providers/WeaponProvider";
import {ArmorProvider} from "@/providers/armor-provider";
import {ShieldProvider} from "@/providers/shield-provider";
import {HelmetProvider} from "@/providers/helmet-provider";
import {BeltsProvider} from "@/providers/equipment-provider/belts-provider";
import {PantsProvider} from "@/providers/equipment-provider/pants-provider";

export class EquipmentGroupProvider {
    public static getCommonEquipment(): LootItemModel[] {
        return [
            ...ArmorProvider.getCommonArmorsList(),
            ...ShieldProvider.getCommonShieldsList(),
            ...HelmetProvider.getCommonHelmetsList(),
            ...BeltsProvider.getCommonBeltsList(),
            ...PantsProvider.getRarePantsList(),
        ]
    }

    public static getRareEquipment(): LootItemModel[] {
        return [
            ...WeaponProvider.getRareWeaponsList(),
            ...BeltsProvider.getRareBeltsList(),
            ...PantsProvider.getRarePantsList(),
        ]
    }

    public static getEpicEquipment(): LootItemModel[] {
        return []
    }

    public static getLegendEquipment(): LootItemModel[] {
        return [
            ...WeaponProvider.getLegends(),
            ...HelmetProvider.getLegendHelmetsList()
        ]
    }

    public static getMythicEquipment(): LootItemModel[] {
        return [
            ...WeaponProvider.getMyths(),
            // ShieldProvider.getDreadwallShield(),
            // HelmetProvider.getOblivorHelm(),
        ]
    }
}