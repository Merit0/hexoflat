import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class BeltsProvider {
    private static beltsFolderPath = "/images/hero-equipment/belts/";

    public static getLeatherBelt(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Leather Belt")
            .lootValue(Randomizer.getRandomIntInRange(15, 25))
            .itemType(ItemType.BELT)
            .lootRarity(Rarity.RARE)
            .lootItemImgPath(this.beltsFolderPath + "rare-type/leather-belt/leather-belt.png")
            .lootItemPoseImgPath(this.beltsFolderPath + "rare-type/leather-belt/leather-belt")
            .price(100)
            .build();
    }

    public static getCommonBeltsList(): LootItemModel[] {
        return Array.of(this.getLeatherBelt());
    }

    public static getRareBeltsList(): LootItemModel[] {
        return Array.of(this.getLeatherBelt());
    }
}