import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class HelmetProvider {
    private static helmetsFolderPath = "/images/hero-equipment/helmets";

    public static getIronHat(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Iron Hat")
            .lootValue(Randomizer.getRandomIntInRange(20, 30))
            .price(100)
            .itemType(ItemType.HELM)
            .lootRarity(Rarity.COMMON)
            .lootItemImgPath(`${this.helmetsFolderPath}/common-type/iron-hat/iron-hat.png`)
            .lootItemPoseImgPath(`${this.helmetsFolderPath}/common-type/iron-hat/iron-hat`)
            .build();
    }

    public static getMandalorianHelmet(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Mandalorian Protector")
            .lootValue(Randomizer.getRandomIntInRange(50, 100))
            .price(5000)
            .itemType(ItemType.HELM)
            .lootRarity(Rarity.MYTHIC)
            .lootItemImgPath(`${this.helmetsFolderPath}/mythic-type/mandalorian-helmet/mandalorian-helmet.png`)
            .lootItemPoseImgPath(`${this.helmetsFolderPath}/mythic-type/mandalorian-helmet/mandalorian-helmet`)
            .build();
    }

    public static getCommonHelmetsList(): LootItemModel[] {
        return Array.of(this.getIronHat());
    }

    public static getLegendHelmetsList(): LootItemModel[] {
        return Array.of(
            // this.getExecutorHelm()
        );
    }
}