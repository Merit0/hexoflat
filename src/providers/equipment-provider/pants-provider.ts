import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class PantsProvider {
    private static pantsFolderPath = "/images/hero-equipment/pants/";

    public static getElfPants(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Elf Pants")
            .lootValue(Randomizer.getRandomIntInRange(5, 20))
            .itemType(ItemType.PANTS)
            .lootRarity(Rarity.RARE)
            .lootItemImgPath(this.pantsFolderPath + "common-type/elf-pants/elf-pants.png")
            .lootItemPoseImgPath(this.pantsFolderPath + "common-type/elf-pants/elf-pants")
            .price(100)
            .build();
    }

    public static getRarePantsList(): LootItemModel[] {
        return Array.of(this.getElfPants());
    }
}