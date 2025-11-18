import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class ShieldProvider {
    private static shieldsFolderPath = "/images/hero-equipment/shields";

    public static getRoundWoodenShield(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Warrior Shield")
            .lootValue(Randomizer.getRandomIntInRange(20, 30))
            .price(100)
            .itemType(ItemType.SHIELD)
            .lootRarity(Rarity.RARE)
            .lootItemImgPath(`${this.shieldsFolderPath}/common-type/warrior-shield/warrior-shield.png`)
            .lootItemPoseImgPath(`${this.shieldsFolderPath}/common-type/warrior-shield/warrior-shield`)
            .build();
    }

    public static getCommonShieldsList(): LootItemModel[] {
        return Array.of(
            this.getRoundWoodenShield(),
        );
    }
}