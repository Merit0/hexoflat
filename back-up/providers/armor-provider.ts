import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "../../back-up/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class ArmorProvider {
    private static heroArmorFolderPath = "/images/hero-equipment/armor/";
    public static getLeatherArmor(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Leather Armor")
            .lootValue(Randomizer.getRandomIntInRange(0, 20))
            .itemType(ItemType.ARMOR)
            .lootRarity(Rarity.RARE)
            .lootItemImgPath(this.heroArmorFolderPath + "common-type/leather-armor/leather-armor.png")
            .lootItemPoseImgPath(this.heroArmorFolderPath + "common-type/leather-armor/leather-armor")
            .price(100)
            .build();
    }

    public static getCommonArmorsList(): LootItemModel[] {
        return Array.of(this.getLeatherArmor());
    }
}