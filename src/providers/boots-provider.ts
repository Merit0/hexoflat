import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class BootsProvider {
    private static heroBootsFolderPath = "/images/hero-equipment/boots/";
    public static getLeatherBoots(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Leather Boots")
            .lootValue(Randomizer.getRandomIntInRange(0, 20))
            .itemType(ItemType.BOOTS)
            .lootRarity(Rarity.COMMON)
            .lootItemImgPath(this.heroBootsFolderPath + "common-type-boots/leather-boots/leather-boots.png")
            .lootItemPoseImgPath(this.heroBootsFolderPath + "common-type-boots/leather-boots/leather-boots")
            .price(100)
            .build();
    }

    public static getCommonBootsList(): LootItemModel[] {
        return Array.of(this.getLeatherBoots());
    }
}