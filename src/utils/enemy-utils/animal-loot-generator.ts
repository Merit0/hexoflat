import {AnimalType} from "@/providers/creatures-provider/animal-provider";
import {LootItemModel} from "@/models/LootItemModel";
import {LootItemBuilder} from "@/builders/LootItemBuilder";
import {ItemType} from "@/enums/ItemType";
import {Rarity} from "@/enums/Rarity";

export class AnimalLootGenerator {
    private static animalSkinPriceMap: Record<AnimalType, number> = {
        [AnimalType.BEAR]: 20,
        [AnimalType.DEAR]: 5,
        [AnimalType.PIG]: 8,
        [AnimalType.PUMA]: 15,
        [AnimalType.SNAKE]: 12,
        [AnimalType.TIGER]: 25,
        [AnimalType.WOLF]: 10,
    };

    static generateSkinLoot(animalFullName: string): LootItemModel {
        const animal = animalFullName.split(' ')[0] as AnimalType;

        if (!(animal in this.animalSkinPriceMap)) {
            throw new Error(`Unknown animal type: ${animal}`);
        }

        const price = this.animalSkinPriceMap[animal];
        return new LootItemBuilder()
            .lootItemName(`${animal} Skin`)
            .itemType(ItemType.SKIN)
            .price(price)
            .lootValue(1)
            .lootRarity(Rarity.COMMON)
            .lootItemImgPath('/images/loot-icons/animal-leather-icon-image.png')
            .build();
    }
}