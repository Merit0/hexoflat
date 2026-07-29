import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "../../back-up/builders/LootItemBuilder";
import {Rarity} from "@/enums/Rarity";
import {ItemType} from "@/enums/ItemType";
import {Randomizer} from "@/utils/Randomizer";
import {HelmetProvider} from "@/providers/helmet-provider";

export class WeaponProvider {
    private static heroWeaponsFolderPath = "/images/hero-equipment/weapons";

    public static getMolner(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Molner")
            .lootValue(Randomizer.getRandomIntInRange(15, 30))
            .price(100)
            .itemType(ItemType.WEAPON)
            .lootRarity(Rarity.RARE)
            .lootItemImgPath(this.heroWeaponsFolderPath + "/hammers/rare-type/molner/molner-hammer.png")
            .lootItemPoseImgPath(this.heroWeaponsFolderPath + "/hammers/rare-type/molner/molner-hammer")
            .build();
    }

    public static getDarkSaber(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Dark Saber")
            .lootValue(Randomizer.getRandomIntInRange(100, 150))
            .price(10000)
            .itemType(ItemType.WEAPON)
            .lootRarity(Rarity.MYTHIC)
            .lootItemImgPath(this.heroWeaponsFolderPath + "/swords/mythic-type/dark-saber/dark-saber-sword.png")
            .lootItemPoseImgPath(this.heroWeaponsFolderPath + "/swords/mythic-type/dark-saber/dark-saber-sword")
            .build();
    }

    public static getCommonWeaponsList(): LootItemModel[] {
        return Array.of(this.getMolner());
    }

    public static getRareWeaponsList(): LootItemModel[] {
        return Array.of(this.getMolner());
    }

    public static getLegends(): LootItemModel[] {
        return Array.of(
            this.getMolner()
        );
    }

    public static getMyths(): LootItemModel[] {
        return [HelmetProvider.getMandalorianHelmet(), WeaponProvider.getDarkSaber()];
    }

    public static getAll(): LootItemModel[] {
        return [...this.getLegends(), ...this.getCommonWeaponsList()];
    }
}