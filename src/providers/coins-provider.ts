import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {ItemType} from "@/enums/ItemType";
import {EnemyType} from "@/enums/EnemyType";
import {Randomizer} from "@/utils/Randomizer";

export class CoinsProvider {
    private static coinsFolderPath = "/images/chests";

    public static getCoinsByEnemyType(enemyType: EnemyType): LootItemModel {
        return new LootItemBuilder()
            .lootItemName("Coins")
            .lootValue(CoinsProvider.getCoinAmount(enemyType))
            .itemType(ItemType.COIN)
            .lootItemImgPath(`${this.coinsFolderPath}/loot-icons/bag-with-coins-image.png`)
            .build();
    }

    private static getCoinAmount(type: EnemyType): number {
        return {
            [EnemyType.BOSS]: Randomizer.getRandomIntInRange(15, 30),
            [EnemyType.CHEEF]: Randomizer.getRandomIntInRange(8, 15),
            [EnemyType.WARRIOR]: Randomizer.getRandomIntInRange(3, 7),
            [EnemyType.ANIMAL]: 0,
        }[type] ?? 0;
    }
}