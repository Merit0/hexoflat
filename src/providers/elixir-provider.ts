import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {Randomizer} from "@/utils/Randomizer";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";
import {EnemyType} from "@/enums/EnemyType";

export class ElixirsProvider {
    private static elixirsFolderPath = "/images/healing-items";

    public static getCommonElixir(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Vital Sip")
            .lootValue(Randomizer.getRandomIntInRange(20, 30))
            .price(50)
            .itemType(ItemType.HEAL)
            .lootRarity(Rarity.COMMON)
            .lootItemImgPath(`${this.elixirsFolderPath}/common-elixir.png`)
            .build();
    }

    public static getRareElixir(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Scarlet Surge")
            .lootValue(Randomizer.getRandomIntInRange(30, 40))
            .price(100)
            .itemType(ItemType.HEAL)
            .lootRarity(Rarity.RARE)
            .lootItemImgPath(`${this.elixirsFolderPath}/rare-elixir.png`)
            .build();
    }

    public static getMythicElixir(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Divine Rebirth")
            .lootValue(Randomizer.getRandomIntInRange(40, 50))
            .price(200)
            .itemType(ItemType.HEAL)
            .lootRarity(Rarity.LEGEND)
            .lootItemImgPath(`${this.elixirsFolderPath}/mythic-elixir.png`)
            .build();
    }

    public static getSmallPotion(): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Crimson Drop")
            .lootValue(Randomizer.getRandomIntInRange(5, 10))
            .price(10)
            .itemType(ItemType.HEAL)
            .lootRarity(Rarity.COMMON)
            .lootItemImgPath(`${this.elixirsFolderPath}/healSmall.png`)
            .build();
    }

    public static getEnemyElixir(type: EnemyType): LootItemModel {
        return {
            [EnemyType.BOSS]: this.getMythicElixir(),
            [EnemyType.CHEEF]: this.getRareElixir(),
            [EnemyType.WARRIOR]: this.getCommonElixir(),
            [EnemyType.ANIMAL]: this.getCommonElixir(),
        }[type] ?? this.getCommonElixir();
    }

    public static getElixirsList(): LootItemModel[] {
        return Array.of(this.getCommonElixir(), this.getRareElixir(), this.getMythicElixir());
    }
}