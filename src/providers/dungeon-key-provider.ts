import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class DungeonKeyProvider {
    private static elixirsFolderPath = "/images/loot-icons";

    public static getGoldenKey(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Golden Key")
            .price(1000)
            .itemType(ItemType.KEY)
            .lootRarity(Rarity.MYTHIC)
            .lootItemImgPath(`${this.elixirsFolderPath}/golden-key-icon.png`)
            .build();
    }
}